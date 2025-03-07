import flatten from 'lodash/flatten'
import {
    StorageModule,
    StorageModuleConfig,
    StorageModuleConstructorArgs,
} from '@worldbrain/storex-pattern-modules'
import { COLLECTION_DEFINITIONS as PAGE_COLLECTION_DEFINITIONS } from '@worldbrain/memex-common/lib/storage/modules/pages/constants'
import { normalizeUrl } from '@worldbrain/memex-url-utils'
import { PipelineRes, VisitInteraction } from 'src/search'
import { initErrHandler } from 'src/search/storage'
import { getTermsField } from '@worldbrain/memex-common/lib/storage/utils'
import {
    mergeTermFields,
    fingerprintsEqual,
} from '@worldbrain/memex-common/lib/page-indexing/utils'
import {
    ContentIdentifier,
    ContentLocator,
} from '@worldbrain/memex-common/lib/page-indexing/types'
import decodeBlob from 'src/util/decode-blob'
import { pageIsStub } from 'src/page-indexing/utils'
import { ContentFingerprint } from '@worldbrain/memex-common/lib/personal-cloud/storage/types'

export default class PageStorage extends StorageModule {
    disableBlobProcessing = false

    constructor(private options: StorageModuleConstructorArgs) {
        super(options)
    }

    getConfig = (): StorageModuleConfig => ({
        collections: {
            ...PAGE_COLLECTION_DEFINITIONS,
        },
        operations: {
            createPage: {
                operation: 'createObject',
                collection: 'pages',
            },
            updatePage: {
                operation: 'updateObject',
                collection: 'pages',
                args: [{ url: '$url:string' }, '$updates'],
            },
            findPageByUrl: {
                operation: 'findObject',
                collection: 'pages',
                args: {
                    url: '$url:string',
                },
            },
            deletePage: {
                operation: 'deleteObject',
                collection: 'pages',
                args: {
                    url: '$url:string',
                },
            },
            createVisit: {
                operation: 'createObject',
                collection: 'visits',
            },
            countVisits: {
                operation: 'countObjects',
                collection: 'visits',
                args: {
                    url: '$url:string',
                },
            },
            findLatestVisitByUrl: {
                operation: 'findObjects',
                collection: 'visits',
                args: [
                    { url: '$url:string' },
                    { sort: [['time', 'desc']], limit: 1 },
                ],
            },
            findVisitsByUrl: {
                operation: 'findObjects',
                collection: 'visits',
                args: {
                    url: '$url:string',
                },
            },
            createFavIcon: {
                operation: 'createObject',
                collection: 'favIcons',
            },
            countFavIconByHostname: {
                operation: 'countObjects',
                collection: 'favIcons',
                args: {
                    hostname: '$hostname:string',
                },
            },
            updateFavIcon: {
                operation: 'updateObject',
                collection: 'favIcons',
                args: [
                    { hostname: '$hostname:string' },
                    { favIcon: '$favIcon' },
                ],
            },
            countBookmarksByUrl: {
                operation: 'countObjects',
                collection: 'bookmarks',
                args: {
                    url: '$url:string',
                },
            },
            findLocatorsByNormalizedUrl: {
                operation: 'findObjects',
                collection: 'locators',
                args: {
                    normalizedUrl: '$normalizedUrl:string',
                },
            },
            findLocatorsByFingerprint: {
                operation: 'findObjects',
                collection: 'locators',
                args: {
                    fingerprint: '$fingerprint:string',
                },
            },
            createLocator: {
                operation: 'createObject',
                collection: 'locators',
            },
        },
    })

    async createPageIfNotExistsOrIsStub(pageData: PipelineRes): Promise<void> {
        const normalizedUrl = normalizeUrl(pageData.url, {})
        const existingPage = await this.operation('findPageByUrl', {
            url: normalizedUrl,
        })

        if (!existingPage || pageIsStub(existingPage)) {
            return this.createPage(pageData)
        }
    }

    async createPageIfNotExists(pageData: PipelineRes): Promise<void> {
        const normalizedUrl = normalizeUrl(pageData.url, {})
        const exists = await this.pageExists(normalizedUrl)

        if (!exists) {
            return this.createPage(pageData)
        }
    }

    async createPage(pageData: PipelineRes) {
        const normalizedUrl = normalizeUrl(pageData.url, {})

        await this.operation('createPage', {
            ...pageData,
            url: normalizedUrl,
        })
    }

    async updatePage(newPageData: PipelineRes, existingPage: PipelineRes) {
        newPageData = { ...newPageData }

        const updates = {}

        for (const fieldName of Object.keys(newPageData)) {
            const termsField = getTermsField('pages', fieldName)

            if (termsField) {
                if (
                    !newPageData[fieldName] ||
                    existingPage[fieldName] === newPageData[fieldName]
                ) {
                    delete newPageData[fieldName]
                    continue
                }

                const mergedTerms = mergeTermFields(
                    termsField,
                    newPageData,
                    existingPage,
                )
                updates[fieldName] = newPageData[fieldName]
                updates[termsField] = mergedTerms
            } else if (
                typeof existingPage[fieldName] === 'string' ||
                typeof newPageData[fieldName] === 'string'
            ) {
                if (newPageData[fieldName] !== existingPage[fieldName]) {
                    updates[fieldName] = newPageData[fieldName]
                }
            } else if (fieldName in PAGE_COLLECTION_DEFINITIONS.pages.fields) {
                updates[fieldName] = newPageData[fieldName]
            }
        }

        if (Object.keys(updates).length) {
            await this.operation('updatePage', {
                url: normalizeUrl(newPageData.url, {}),
                updates,
            })
        }
    }

    async createVisitsIfNeeded(url: string, visitTimes: number[]) {
        interface Visit {
            url: string
            time: number
        }
        const normalizedUrl = normalizeUrl(url, {})
        const newVisits: Visit[] = []
        for (const visitTime of visitTimes) {
            newVisits.push({ url: normalizedUrl, time: visitTime })
        }
        for (const visit of newVisits) {
            await this.operation('createVisit', visit)
        }
    }

    async pageExists(url: string): Promise<boolean> {
        const normalizedUrl = normalizeUrl(url, {})
        const existingPage = await this.operation('findPageByUrl', {
            url: normalizedUrl,
        })

        return !!existingPage
    }

    async pageHasVisits(url: string): Promise<boolean> {
        const normalizedUrl = normalizeUrl(url, {})
        const visitCount = await this.operation('countVisits', {
            url: normalizedUrl,
        })
        return visitCount > 0
    }

    async addPageVisit(url: string, time: number) {
        const normalizedUrl = normalizeUrl(url, {})
        await this.operation('createVisit', { url: normalizedUrl, time })
    }

    async addPageVisitIfHasNone(url: string, time: number) {
        const hasVisits = await this.pageHasVisits(url)

        if (!hasVisits) {
            await this.addPageVisit(url, time)
        }
    }

    async getPage(url: string): Promise<PipelineRes | null> {
        const normalizedUrl = normalizeUrl(url, {})
        return this.operation('findPageByUrl', { url: normalizedUrl })
    }

    async updateVisitMetadata(
        visit: { url: string; time: number },
        data: Partial<VisitInteraction>,
    ) {
        const normalizedUrl = normalizeUrl(visit.url, {})

        return this.options.storageManager
            .collection('visits')
            .updateObjects({ time: visit.time, url: normalizedUrl }, data)
            .catch(initErrHandler())
    }

    async createFavIconIfNeeded(hostname: string, favIcon: string | Blob) {
        const exists = !!(await this.operation('countFavIconByHostname', {
            hostname,
        }))
        if (!exists) {
            await this.operation('createFavIcon', {
                hostname,
                favIcon: await this._maybeDecodeBlob(favIcon),
            })
        }

        return { created: !exists }
    }

    async createOrUpdateFavIcon(hostname: string, favIcon: string | Blob) {
        const { created } = await this.createFavIconIfNeeded(hostname, favIcon)
        if (!created) {
            await this.operation('updateFavIcon', {
                hostname,
                favIcon: await this._maybeDecodeBlob(favIcon),
            })
        }
    }

    async deletePageIfOrphaned(url: string) {
        const normalizedUrl = normalizeUrl(url, {})
        const visitCount = await this.operation('countVisits', {
            url: normalizeUrl,
        })
        if (visitCount > 0) {
            return
        }
        if (
            await this.operation('countBookmarksByUrl', { url: normalizeUrl })
        ) {
            return
        }

        await this.operation('deletePage', {
            url: normalizedUrl,
        })
    }

    async getLatestVisit(
        url: string,
    ): Promise<{ url: string; time: number } | null> {
        const normalizedUrl = normalizeUrl(url, {})
        const result = await this.operation('findLatestVisitByUrl', {
            url: normalizedUrl,
        })
        return result.length ? result[0] : null
    }

    async getContentIdentifier(params: {
        fingerprints: Array<ContentFingerprint>
    }): Promise<{
        identifier: ContentIdentifier
        locators: ContentLocator[]
    } | null> {
        const locators: Array<ContentLocator> = flatten(
            await Promise.all(
                params.fingerprints.map((fingerprint) =>
                    this.operation('findLocatorsByFingerprint', {
                        fingerprint,
                    }),
                ),
            ),
        )
        const locator = locators.find(
            (existingLocator) =>
                !!params.fingerprints.find((fingerprint) =>
                    fingerprintsEqual(
                        {
                            fingerprintScheme: fingerprint.fingerprintScheme,
                            fingerprint: fingerprint.fingerprint,
                        },
                        existingLocator,
                    ),
                ),
        )
        if (!locator) {
            return null
        }
        const page = await this.getPage(locator.normalizedUrl)
        if (!page) {
            return null
        }
        return {
            locators,
            identifier: {
                normalizedUrl: page.url,
                fullUrl: page.fullUrl,
            },
        }
    }

    async findLocatorsByNormalizedUrl(
        normalizedUrl: string,
    ): Promise<ContentLocator[]> {
        return this.operation('findLocatorsByNormalizedUrl', {
            normalizedUrl,
        })
    }

    async storeLocators(params: {
        identifier: ContentIdentifier
        locators: ContentLocator[]
    }) {
        const existingLocators: Array<ContentLocator> = await this.operation(
            'findLocatorsByNormalizedUrl',
            params.identifier,
        )
        const toStore = params.locators.filter((locator) => {
            return !existingLocators.find(
                (existing) =>
                    fingerprintsEqual(existing, locator) &&
                    existing.originalLocation === locator.originalLocation,
            )
        })
        await Promise.all(
            toStore.map((locator) => this.operation('createLocator', locator)),
        )
    }

    async _maybeDecodeBlob(
        blobOrString: Blob | string,
    ): Promise<Blob | string> {
        if (this.disableBlobProcessing) {
            return blobOrString
        }

        return typeof blobOrString === 'string'
            ? decodeBlob(blobOrString)
            : blobOrString
    }
}
