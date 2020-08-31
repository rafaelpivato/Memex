import { normalizeUrl } from '@worldbrain/memex-url-utils'
import { setupBackgroundIntegrationTest } from 'src/tests/background-integration-tests'
import { analyzeTemplate, generateTemplateDocs, joinTags } from './utils'
import { KEYS_TO_REQUIREMENTS, LEGACY_KEYS, NOTE_KEYS } from './constants'
import { TemplateDocKey, TemplateAnalysis } from './types'
import * as DATA from './utils.test.data'
import { getTemplateDataFetchers } from './background'

const testAnalysis = (code: string, expected: TemplateAnalysis) => {
    const analysis = analyzeTemplate({ code })
    expect({ code, analysis }).toEqual({
        code,
        analysis: expected,
    })
}

describe('Content template rendering', () => {
    it('should correctly analyze templates', () => {
        for (const [key, requirement] of Object.entries(KEYS_TO_REQUIREMENTS)) {
            const code = `{{{${key}}}}`
            testAnalysis(code, {
                requirements: expect.objectContaining({
                    [requirement]: true,
                }),
                noteUsage: NOTE_KEYS[key] ? 'single' : undefined,
                usesLegacyTags: LEGACY_KEYS.has(key as TemplateDocKey),
            })
        }
    })

    it('should correctly analyze templates containing loops', () => {
        for (const [key, requirement] of Object.entries(KEYS_TO_REQUIREMENTS)) {
            const code = `{{#Notes}}{{{${key}}}}{{/Notes}}`
            testAnalysis(code, {
                requirements: expect.objectContaining({
                    [requirement]: true,
                }),
                noteUsage: NOTE_KEYS[key] ? 'multiple' : undefined,
                usesLegacyTags: LEGACY_KEYS.has(key as TemplateDocKey),
            })
        }
    })

    it('should correctly detect note usage in a template', () => {
        testAnalysis(`{{{PageTitle}}}`, {
            requirements: {
                page: true,
            },
            usesLegacyTags: false,
        })
        testAnalysis(`{{{NoteText}}}`, {
            requirements: {
                note: true,
            },
            noteUsage: 'single',
            usesLegacyTags: false,
        })
        testAnalysis(`{{#Notes}}{{{NoteText}}}{{/Notes}}`, {
            requirements: {
                note: true,
            },
            noteUsage: 'multiple',
            usesLegacyTags: false,
        })
        testAnalysis(
            `{{{NoteText}}}{{#Notes}}{{{NoteText}}}{{/Notes}}{{{NoteText}}}`,
            {
                requirements: {
                    note: true,
                },
                noteUsage: 'multiple',
                usesLegacyTags: false,
            },
        )
    })
})

async function setupTest() {
    const {
        backgroundModules,
        storageManager,
    } = await setupBackgroundIntegrationTest()

    await storageManager.collection('pages').createObject(DATA.testPageA)
    await storageManager.collection('pages').createObject(DATA.testPageB)
    await storageManager.collection('annotations').createObject({
        url: DATA.testAnnotationAUrl,
        comment: DATA.testAnnotationAText,
    })

    await storageManager.collection('annotations').createObject({
        url: DATA.testAnnotationBUrl,
        body: DATA.testAnnotationBHighlight,
    })

    const insertTags = (url: string, tags: string[]) =>
        Promise.all(
            tags.map((name) =>
                storageManager.collection('tags').createObject({ url, name }),
            ),
        )

    await insertTags(normalizeUrl(DATA.testPageAUrl), DATA.testPageATags)
    await insertTags(normalizeUrl(DATA.testPageBUrl), DATA.testPageBTags)
    await insertTags(DATA.testAnnotationAUrl, DATA.testAnnotationATags)
    await insertTags(DATA.testAnnotationBUrl, DATA.testAnnotationBTags)

    const dataFetchers = getTemplateDataFetchers({ storageManager })

    return { backgroundModules, storageManager, dataFetchers }
}

describe('Content template doc generation', () => {
    const testTemplate = { isFavourite: false, title: 'test', id: -1 }

    it('should correctly generate template docs for a single page', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: { ...testTemplate, code: '{{{PageTitle}}}' },
                normalizedPageUrls: [DATA.testPageA.url],
                annotationUrls: [],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: 'test page A title',
                PageUrl: DATA.testPageAUrl,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                title: DATA.testPageA.fullTitle,
                url: DATA.testPageAUrl,
                tags: DATA.testPageATags,
            },
        ])
    })

    it('should correctly generate template docs for multiple pages', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: {
                    ...testTemplate,
                    code: '{{#Pages}}{{{PageTitle}}}{{/Pages}}',
                },
                normalizedPageUrls: [DATA.testPageA.url, DATA.testPageB.url],
                annotationUrls: [],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: DATA.testPageA.fullTitle,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                PageUrl: DATA.testPageAUrl,
                title: DATA.testPageA.fullTitle,
                tags: DATA.testPageATags,
                url: DATA.testPageAUrl,
            },
            {
                PageTitle: DATA.testPageB.fullTitle,
                PageTags: joinTags(DATA.testPageBTags),
                PageTagList: DATA.testPageBTags,
                PageUrl: DATA.testPageBUrl,
                title: DATA.testPageB.fullTitle,
                tags: DATA.testPageBTags,
                url: DATA.testPageBUrl,
            },
        ])
    })

    it('should correctly generate template docs for single annotation, but only with page references', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: { ...testTemplate, code: '{{{PageTitle}}}' },
                normalizedPageUrls: [DATA.testPageA.url],
                annotationUrls: [DATA.testAnnotationAUrl],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: DATA.testPageA.fullTitle,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                PageUrl: DATA.testPageAUrl,
                title: DATA.testPageA.fullTitle,
                tags: DATA.testPageATags,
                url: DATA.testPageAUrl,
            },
        ])
    })

    it('should correctly generate template docs for single annotation', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: { ...testTemplate, code: '{{{NoteText}}}' },
                normalizedPageUrls: [DATA.testPageA.url],
                annotationUrls: [DATA.testAnnotationAUrl],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: DATA.testPageA.fullTitle,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                PageUrl: DATA.testPageAUrl,
                NoteText: DATA.testAnnotationAText,
                NoteTags: DATA.testAnnotationATags,

                title: DATA.testPageA.fullTitle,
                tags: DATA.testPageATags,
                url: DATA.testPageAUrl,
            },
        ])
    })

    it('should correctly generate template docs for single annotation, but iterating through the notes array', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: {
                    ...testTemplate,
                    code: '{{#Notes}}{{{NoteText}}}{{/Notes}}',
                },
                normalizedPageUrls: [DATA.testPageA.url],
                annotationUrls: [DATA.testAnnotationAUrl],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: DATA.testPageA.fullTitle,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                PageUrl: DATA.testPageAUrl,
                Notes: [
                    {
                        NoteText: DATA.testAnnotationAText,
                        NoteTags: DATA.testAnnotationATags,
                    },
                ],

                title: DATA.testPageA.fullTitle,
                tags: DATA.testPageATags,
                url: DATA.testPageAUrl,
            },
        ])
    })

    it('should correctly generate template docs for multiple annotations, but only with page references', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: { ...testTemplate, code: '{{{PageTitle}}}' },
                normalizedPageUrls: [DATA.testPageA.url],
                annotationUrls: [
                    DATA.testAnnotationAUrl,
                    DATA.testAnnotationBUrl,
                ],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: DATA.testPageA.fullTitle,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                PageUrl: DATA.testPageAUrl,

                title: DATA.testPageA.fullTitle,
                tags: DATA.testPageATags,
                url: DATA.testPageAUrl,
            },
        ])
    })

    it('should correctly generate template docs for multiple annotations, but only referencing top-level annotation', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: { ...testTemplate, code: '{{{NoteText}}}' },
                normalizedPageUrls: [DATA.testPageA.url],
                annotationUrls: [
                    DATA.testAnnotationAUrl,
                    DATA.testAnnotationBUrl,
                ],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: DATA.testPageA.fullTitle,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                PageUrl: DATA.testPageAUrl,
                NoteText: DATA.testAnnotationAText,

                title: DATA.testPageA.fullTitle,
                tags: DATA.testPageATags,
                url: DATA.testPageAUrl,
            },
        ])
    })

    it('should correctly generate template docs for multiple annotations', async () => {
        const { dataFetchers } = await setupTest()

        expect(
            await generateTemplateDocs({
                template: {
                    ...testTemplate,
                    code: '{{#Notes}}{{{NoteText}}}{{/Notes}}',
                },
                normalizedPageUrls: [DATA.testPageA.url],
                annotationUrls: [
                    DATA.testAnnotationAUrl,
                    DATA.testAnnotationBUrl,
                ],
                dataFetchers,
            }),
        ).toEqual([
            {
                PageTitle: DATA.testPageA.fullTitle,
                PageTags: joinTags(DATA.testPageATags),
                PageTagList: DATA.testPageATags,
                PageUrl: DATA.testPageAUrl,
                Notes: [
                    {
                        NoteText: DATA.testAnnotationAText,
                        NoteTags: DATA.testAnnotationATags,
                    },
                    {
                        NoteHighlight: DATA.testAnnotationBHighlight,
                        NoteTags: DATA.testAnnotationBTags,
                    },
                ],

                title: DATA.testPageA.fullTitle,
                tags: DATA.testPageATags,
                url: DATA.testPageAUrl,
            },
        ])
    })
})
