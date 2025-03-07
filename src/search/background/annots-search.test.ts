import { normalizeUrl } from '@worldbrain/memex-url-utils'

import * as DATA from './index.test.data'
import { PageUrlsByDay, AnnotationsSearchResponse } from './types'
import { setupBackgroundIntegrationTest } from 'src/tests/background-integration-tests'
import { AnnotationPrivacyLevels } from '@worldbrain/memex-common/lib/annotations/types'
import { Annotation } from 'src/annotations/types'
import { BackgroundIntegrationTestSetup } from 'src/tests/integration-tests'
import { shareOptsToPrivacyLvl } from 'src/annotations/utils'

const countAnnots = (res) => {
    return res.docs.reduce(
        (count, { annotations }) => count + annotations.length,
        0,
    )
}

const flattenAnnotUrls = (res) => {
    return res.docs.reduce(
        (urls, { annotations }) => [...urls, ...annotations.map((a) => a.url)],
        [],
    )
}

const flattenAnnotUrlsFromDayMap = (res: PageUrlsByDay) => {
    const urls: string[] = []

    for (const annotsByPageUrl of Object.values(res)) {
        const annots = Object.values(annotsByPageUrl) as Annotation[][]
        urls.push(...[].concat(...annots).map((a) => a.url))
    }

    return urls
}

describe('Annotations search', () => {
    let coll1Id: number
    let coll2Id: number

    async function insertTestData({
        storageManager,
        backgroundModules,
        fetchPageDataProcessor,
    }: BackgroundIntegrationTestSetup) {
        const annotsStorage = backgroundModules.directLinking.annotationStorage
        const customListsBg = backgroundModules.customLists
        const contentSharingBg = backgroundModules.contentSharing
        fetchPageDataProcessor.mockPage = {
            url: DATA.highlight.object.pageUrl,
            hostname: normalizeUrl(DATA.highlight.object.pageUrl),
            domain: normalizeUrl(DATA.highlight.object.pageUrl),
            fullTitle: DATA.highlight.object.pageTitle,
            text: DATA.highlight.object.body,
            fullUrl: DATA.highlight.object.url,
            tags: [],
            terms: [],
            titleTerms: [],
            urlTerms: [],
        }

        for (const annot of [
            DATA.highlight,
            DATA.annotation,
            DATA.comment,
            DATA.hybrid,
        ]) {
            // Pages also need to be seeded to match domains filters against
            await storageManager.collection('pages').createObject({
                url: annot.object.pageUrl,
                hostname: normalizeUrl(annot.object.pageUrl),
                domain: normalizeUrl(annot.object.pageUrl),
                title: annot.object.pageTitle,
                text: annot.object.body,
                canonicalUrl: annot.object.url,
            })

            // Create a dummy visit 30 secs before annot creation time
            await storageManager.collection('visits').createObject({
                url: annot.object.pageUrl,
                time: new Date(
                    annot.object.createdWhen.getTime() - 300000,
                ).getTime(),
            })

            await annotsStorage.createAnnotation({ ...annot.object })

            if (annot.isShared) {
                await storageManager
                    .collection('sharedAnnotationMetadata')
                    .createObject({
                        localId: annot.object.url,
                        remoteId: backgroundModules.contentSharing.options.generateServerId(
                            'sharedAnnotationMetadata',
                        ),
                        excludeFromLists: false,
                    })
            }
            await storageManager
                .collection('annotationPrivacyLevels')
                .createObject({
                    annotation: annot.object.url,
                    privacyLevel: shareOptsToPrivacyLvl({
                        isBulkShareProtected: annot.isProtected,
                        shouldShare: annot.isShared,
                    }),
                    createdWhen: new Date(),
                })
        }

        // Insert bookmarks
        await annotsStorage.toggleAnnotBookmark({ url: DATA.hybrid.object.url })
        await annotsStorage.toggleAnnotBookmark({
            url: DATA.highlight.object.url,
        })

        // Insert collections + collection entries
        coll1Id = await customListsBg.createCustomList({
            name: DATA.coll1,
        })
        coll2Id = await customListsBg.createCustomList({
            name: DATA.coll2,
        })

        await contentSharingBg.shareList({ localListId: coll1Id })

        await customListsBg.insertPageToList({
            id: coll2Id,
            url: DATA.fullPageUrl1,
        })
        await customListsBg.insertPageToList({
            id: coll1Id,
            url: DATA.fullPageUrl1,
        })
        await customListsBg.insertPageToList({
            id: coll1Id,
            url: DATA.fullPageUrl2,
        })
        await contentSharingBg.shareAnnotationToSomeLists({
            localListIds: [coll1Id, coll2Id],
            annotationUrl: DATA.highlight.object.url,
        })
        await contentSharingBg.shareAnnotationToSomeLists({
            localListIds: [coll1Id],
            annotationUrl: DATA.hybrid.object.url,
        })

        // Insert tags
        await annotsStorage.modifyTags(true)(
            DATA.tag1,
            DATA.annotation.object.url,
        )
        await annotsStorage.modifyTags(true)(
            DATA.tag2,
            DATA.annotation.object.url,
        )
    }

    async function setupTest() {
        const setup = await setupBackgroundIntegrationTest({
            includePostSyncProcessor: true,
        })
        await insertTestData(setup)

        return {
            storageMan: setup.storageManager,
            searchBg: setup.backgroundModules.search,
            annotsBg: setup.backgroundModules.directLinking,
        }
    }

    describe('terms-based searches', () => {
        test('plain terms search', async () => {
            const { searchBg } = await setupTest()

            const resA = await searchBg.searchAnnotations({
                query: 'comment',
            })
            expect(countAnnots(resA)).toBe(2)
            expect(flattenAnnotUrls(resA)).toEqual(
                expect.arrayContaining([
                    DATA.comment.object.url,
                    DATA.annotation.object.url,
                ]),
            )

            const resB = await searchBg.searchAnnotations({
                query: 'bla',
            })
            expect(countAnnots(resB)).toBe(2)
            expect(flattenAnnotUrls(resB)).toEqual(
                expect.arrayContaining([
                    DATA.hybrid.object.url,
                    DATA.annotation.object.url,
                ]),
            )
        })

        test('bookmarks filter', async () => {
            const { searchBg } = await setupTest()

            const resFiltered = await searchBg.searchAnnotations({
                query: 'bla',
                bookmarksOnly: true,
            })
            expect(countAnnots(resFiltered)).toBe(1)
            expect(flattenAnnotUrls(resFiltered)).toEqual(
                expect.arrayContaining([DATA.hybrid.object.url]),
            )

            const resUnfiltered = await searchBg.searchAnnotations({
                query: 'bla',
                bookmarksOnly: false,
            })
            expect(countAnnots(resUnfiltered)).toBe(2)
            expect(flattenAnnotUrls(resUnfiltered)).toEqual(
                expect.arrayContaining([
                    DATA.hybrid.object.url,
                    DATA.annotation.object.url,
                ]),
            )
        })

        test('collections filter', async () => {
            const { searchBg } = await setupTest()

            const resA = await searchBg.searchAnnotations({
                query: 'highlight',
                lists: [coll1Id],
            })
            expect(countAnnots(resA)).toBe(2)

            const resB = await searchBg.searchAnnotations({
                query: 'highlight',
                lists: [coll1Id, coll2Id],
            })
            expect(countAnnots(resB)).toBe(1)

            const resC = await searchBg.searchAnnotations({
                query: 'highlight',
                lists: [9999999], // Not a real collection ID
            })
            expect(countAnnots(resC)).toBe(0)
        })

        test('tags filter', async () => {
            const { searchBg } = await setupTest()

            const resFiltered = await searchBg.searchAnnotations({
                query: 'comment',
                tagsInc: [DATA.tag1],
            })
            expect(countAnnots(resFiltered)).toBe(1)
            expect(flattenAnnotUrls(resFiltered)).toEqual(
                expect.arrayContaining([DATA.annotation.object.url]),
            )

            const resUnfiltered = await searchBg.searchAnnotations({
                query: 'comment',
            })
            expect(countAnnots(resUnfiltered)).toBe(2)
            expect(flattenAnnotUrls(resUnfiltered)).toEqual(
                expect.arrayContaining([
                    DATA.annotation.object.url,
                    DATA.comment.object.url,
                ]),
            )
        })

        test('domains filter', async () => {
            const { searchBg } = await setupTest()

            const resUnfiltered = await searchBg.searchAnnotations({
                query: 'highlight',
            })
            expect(countAnnots(resUnfiltered)).toBe(2)
            expect(flattenAnnotUrls(resUnfiltered)).toEqual(
                expect.arrayContaining([
                    DATA.hybrid.object.url,
                    DATA.highlight.object.url,
                ]),
            )

            const resExc = await searchBg.searchAnnotations({
                query: 'highlight',
                domainsExclude: ['annotation.url'],
            })
            expect(countAnnots(resExc)).toBe(1)
            expect(flattenAnnotUrls(resExc)).toEqual(
                expect.arrayContaining([DATA.hybrid.object.url]),
            )

            const resInc = await searchBg.searchAnnotations({
                query: 'highlight',
                domains: ['annotation.url'],
            })
            expect(countAnnots(resInc)).toBe(1)
            expect(flattenAnnotUrls(resInc)).toEqual(
                expect.arrayContaining([DATA.highlight.object.url]),
            )
        })

        test('page result limit parameter', async () => {
            const { searchBg } = await setupTest()

            const single = await searchBg.searchAnnotations({
                query: 'term',
                limit: 1,
            })
            const double = await searchBg.searchAnnotations({
                query: 'term',
                limit: 2,
            })
            const stillDouble = await searchBg.searchAnnotations({
                query: 'term',
                limit: 3,
            })

            expect(single.docs.length).toBe(1)
            expect(double.docs.length).toBe(2)
            expect(stillDouble.docs.length).toBe(2)
        })

        test('comment-terms only terms search', async () => {
            const { searchBg } = await setupTest()

            const resCommentsOnly = await searchBg.searchAnnotations({
                query: 'term',
                contentTypes: { highlights: false, notes: true, pages: false },
            })
            expect(countAnnots(resCommentsOnly)).toBe(1)
            expect(flattenAnnotUrls(resCommentsOnly)).toEqual(
                expect.arrayContaining([DATA.hybrid.object.url]),
            )

            const resAllFields = await searchBg.searchAnnotations({
                query: 'term',
            })
            expect(countAnnots(resAllFields)).toBe(2)
            expect(flattenAnnotUrls(resAllFields)).toEqual(
                expect.arrayContaining([
                    DATA.hybrid.object.url,
                    DATA.comment.object.url,
                ]),
            )
        })

        test('highlighted-text-terms only terms search', async () => {
            const { searchBg } = await setupTest()

            const resBodyOnly = await searchBg.searchAnnotations({
                query: 'term',
                contentTypes: { highlights: true, notes: false, pages: false },
            })
            expect(countAnnots(resBodyOnly)).toBe(1)
            expect(flattenAnnotUrls(resBodyOnly)).toEqual(
                expect.arrayContaining([DATA.comment.object.url]),
            )

            const resAllFields = await searchBg.searchAnnotations({
                query: 'term',
            })
            expect(countAnnots(resAllFields)).toBe(2)
            expect(flattenAnnotUrls(resAllFields)).toEqual(
                expect.arrayContaining([
                    DATA.hybrid.object.url,
                    DATA.comment.object.url,
                ]),
            )
        })
    })

    describe('URL-based searches', () => {
        test('blank', async () => {
            const { annotsBg } = await setupTest()

            const results = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                { url: DATA.normalizedPageUrl1 },
            )
            expect(results.length).toBe(3)
            expect(results.map((a) => a.url)).toEqual(
                expect.arrayContaining([
                    DATA.highlight.object.url,
                    DATA.annotation.object.url,
                    DATA.comment.object.url,
                ]),
            )
        })

        test('bookmarks filter', async () => {
            const { annotsBg } = await setupTest()

            const results = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                { url: DATA.normalizedPageUrl1, bookmarksOnly: true },
            )
            expect(results.length).toBe(1)
            expect(results.map((a) => a.url)).toEqual(
                expect.arrayContaining([DATA.highlight.object.url]),
            )
        })

        test('tags included filter', async () => {
            const { annotsBg } = await setupTest()

            const results = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                {
                    url: DATA.normalizedPageUrl1,
                    tagsInc: [DATA.tag1],
                },
            )
            expect(results.length).toBe(1)
            expect(results.map((a) => a.url)).toEqual(
                expect.arrayContaining([DATA.annotation.object.url]),
            )
        })

        test('tags excluded filter', async () => {
            const { annotsBg } = await setupTest()

            const results = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                {
                    url: DATA.normalizedPageUrl1,
                    tagsExc: [DATA.tag1, DATA.tag2, 'dummy'],
                },
            )
            expect(results.length).toBe(0)
        })

        test('collections filter', async () => {
            const { annotsBg } = await setupTest()

            const resA = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                {
                    url: DATA.normalizedPageUrl1,
                    collections: [coll1Id],
                },
            )
            expect(resA.map((a) => a.url)).toEqual(
                expect.arrayContaining([
                    DATA.highlight.object.url,
                    DATA.annotation.object.url,
                ]),
            )

            const resB = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                {
                    url: DATA.normalizedPageUrl1,
                    collections: [coll1Id, coll2Id],
                },
            )
            expect(resB.map((a) => a.url)).toEqual(
                expect.arrayContaining([DATA.highlight.object.url]),
            )

            const resC = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                {
                    url: DATA.normalizedPageUrl2,
                    collections: [coll1Id],
                },
            )
            expect(resC.map((a) => a.url)).toEqual(
                expect.arrayContaining([DATA.hybrid.object.url]),
            )

            const resD = await annotsBg.getAllAnnotationsByUrl(
                { tab: null },
                {
                    url: DATA.normalizedPageUrl2,
                    collections: [coll1Id, coll2Id],
                },
            )
            expect(resD.map((a) => a.url)).toEqual([])
        })
    })

    describe('blank searches', () => {
        test('all content types search', async () => {
            const { searchBg } = await setupTest()

            const { docs: results } = await searchBg.searchPages({
                contentTypes: { highlights: true, notes: true, pages: true },
            })

            // Ensure order is by latest visit
            expect(results).toEqual([
                expect.objectContaining({
                    url: DATA.highlight.object.pageUrl,
                    annotations: [
                        expect.objectContaining({
                            url: DATA.highlight.object.url,
                            isBulkShareProtected: true,
                            isShared: true,
                        }),
                        expect.objectContaining({
                            url: DATA.annotation.object.url,
                            isBulkShareProtected: false,
                            isShared: true,
                        }),
                        expect.objectContaining({
                            url: DATA.comment.object.url,
                            isBulkShareProtected: false,
                            isShared: false,
                        }),
                    ],
                }),
                expect.objectContaining({
                    url: DATA.hybrid.object.pageUrl,
                    annotations: [
                        expect.objectContaining({
                            url: DATA.hybrid.object.url,
                            isBulkShareProtected: true,
                            isShared: false,
                        }),
                    ],
                }),
            ])
        })

        test('should return share data with annots search', async () => {
            const { searchBg } = await setupTest()

            const resA = (await searchBg.searchAnnotations(
                {},
            )) as AnnotationsSearchResponse

            const foundAnnotationsA: Annotation[] = []
            const foundAnnotationsB: Annotation[] = []

            for (const annotsByPageUrl of Object.values(resA.annotsByDay)) {
                const annots = Object.values(annotsByPageUrl) as Annotation[][]
                foundAnnotationsA.push(...annots.flat())
            }

            expect(foundAnnotationsA).toEqual([
                expect.objectContaining({
                    url: DATA.hybrid.object.url,
                    isBulkShareProtected: true,
                    isShared: false,
                }),
                expect.objectContaining({
                    url: DATA.annotation.object.url,
                    isBulkShareProtected: false,
                    isShared: true,
                }),
                expect.objectContaining({
                    url: DATA.comment.object.url,
                    isBulkShareProtected: false,
                    isShared: false,
                }),
                expect.objectContaining({
                    url: DATA.highlight.object.url,
                    isBulkShareProtected: true,
                    isShared: true,
                }),
            ])

            const resB = await searchBg.searchAnnotations({
                query: 'comment',
            })

            for (const { annotations } of Object.values(resB.docs)) {
                foundAnnotationsB.push(...annotations)
            }

            expect(foundAnnotationsB).toEqual([
                expect.objectContaining({
                    url: DATA.annotation.object.url,
                    isBulkShareProtected: false,
                    isShared: true,
                }),
                expect.objectContaining({
                    url: DATA.comment.object.url,
                    isBulkShareProtected: false,
                    isShared: false,
                }),
            ])
        })

        test('annots-only search', async () => {
            const { searchBg } = await setupTest()

            const {
                annotsByDay: results,
                resultsExhausted,
            }: any = await searchBg.searchAnnotations({})

            const resUrls = flattenAnnotUrlsFromDayMap(results)
            expect(resultsExhausted).toBe(true)
            // Ensure order of pages is by latest annot
            expect(resUrls).toEqual(
                expect.arrayContaining([
                    DATA.hybrid.object.url,
                    DATA.comment.object.url,
                    DATA.highlight.object.url,
                    DATA.annotation.object.url,
                ]),
            )
        })

        test('time filters', async () => {
            const { searchBg } = await setupTest()

            // Should result in only the newest annot
            const { annotsByDay: resA }: any = await searchBg.searchAnnotations(
                {
                    startDate: new Date('2019-01-30'),
                },
            )

            const resAUrls = flattenAnnotUrlsFromDayMap(resA)
            expect(resAUrls.length).toBe(1)
            expect(resAUrls).toEqual(
                expect.arrayContaining([DATA.hybrid.object.url]),
            )

            // Should result in only the oldest annot
            const { annotsByDay: resB }: any = await searchBg.searchAnnotations(
                {
                    endDate: new Date('2019-01-26'),
                },
            )

            const resBUrls = flattenAnnotUrlsFromDayMap(resB)
            expect(resBUrls.length).toBe(1)
            expect(resBUrls).toEqual(
                expect.arrayContaining([DATA.highlight.object.url]),
            )

            // Should result in only the oldest annot
            const { annotsByDay: resC }: any = await searchBg.searchAnnotations(
                {
                    startDate: new Date('2019-01-25'),
                    endDate: new Date('2019-01-28T23:00Z'),
                },
            )

            const resCUrls = flattenAnnotUrlsFromDayMap(resC)
            expect(resCUrls.length).toBe(2)
            expect(resCUrls).toEqual(
                expect.arrayContaining([
                    DATA.comment.object.url,
                    DATA.highlight.object.url,
                ]),
            )
        })

        test('tags filter', async () => {
            const { searchBg } = await setupTest()

            const {
                annotsByDay: results,
                resultsExhausted,
            }: any = await searchBg.searchAnnotations({
                tagsInc: [DATA.tag1],
            })

            const resUrls = flattenAnnotUrlsFromDayMap(results)
            expect(resultsExhausted).toBe(true)
            expect(resUrls).toEqual([DATA.annotation.object.url])
        })
    })

    test('annotations on page search results should have tags attached', async () => {
        const { searchBg } = await setupTest()

        const resA = await searchBg.searchAnnotations({ query: 'comment' })

        expect(resA.docs[0].annotations[0].tags).toEqual([DATA.tag1, DATA.tag2])
        expect(resA.docs[0].annotations[1].tags).toEqual([])

        const resB = await searchBg.searchAnnotations({ query: 'comment' })

        expect(resB.docs[0].annotations[0].tags).toEqual([DATA.tag1, DATA.tag2])
        expect(resB.docs[0].annotations[1].tags).toEqual([])
    })

    test('annotations on page search results should have lists attached', async () => {
        const { searchBg } = await setupTest()

        const resA = await searchBg.searchAnnotations({ query: 'highlight' })
        expect(resA.docs[0].annotations).toEqual([
            expect.objectContaining({
                lists: [coll1Id, coll2Id],
            }),
        ])
    })
})
