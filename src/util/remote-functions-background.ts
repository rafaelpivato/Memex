import { runInBackground } from 'src/util/webextensionRPC'
import { NotificationCreator } from 'src/util/notification-types'
import { BookmarksInterface } from 'src/bookmarks/background/types'
import { AuthRemoteFunctionsInterface } from 'src/authentication/background/types'
import { SubscriptionsService } from '@worldbrain/memex-common/lib/subscriptions/types'
import { FeaturesInterface } from 'src/features/background/feature-opt-ins'
import { RemoteTagsInterface } from 'src/tags/background/types'
import { RemoteCollectionsInterface } from 'src/custom-lists/background/types'
import { RemoteReaderInterface } from 'src/reader/types'
import { AnnotationInterface } from 'src/annotations/background/types'
import { RemoteCopyPasterInterface } from 'src/copy-paster/background/types'
import { FeaturesBetaInterface } from 'src/features/background/feature-beta'
import { ContentSharingInterface } from 'src/content-sharing/background/types'
import type { PDFRemoteInterface } from 'src/pdf/background/types'
import type { PersonalCloudRemoteInterface } from 'src/personal-cloud/background/types'
import type { AnalyticsInterface } from 'src/analytics/background/types'

export interface RemoteFunctionImplementations<
    Role extends 'provider' | 'caller'
> {
    notifications: NotificationCreator
    bookmarks: BookmarksInterface
    auth: AuthRemoteFunctionsInterface
    analytics: AnalyticsInterface
    subscription: SubscriptionsService
    // features: FeaturesInterface
    featuresBeta: FeaturesBetaInterface
    tags: RemoteTagsInterface
    collections: RemoteCollectionsInterface
    copyPaster: RemoteCopyPasterInterface
    readablePageArchives: RemoteReaderInterface
    contentSharing: ContentSharingInterface
    personalCloud: PersonalCloudRemoteInterface
    pdf: PDFRemoteInterface
}

// See `src/background.ts` for the concrete remote function bindings
// (in setupRemoteFunctionsImplementations and elsewhere)
export const remoteFunctions: RemoteFunctionImplementations<'caller'> = {
    analytics: runInBackground(),
    notifications: runInBackground(),
    bookmarks: runInBackground(),
    auth: runInBackground(),
    subscription: runInBackground(),
    // features: runInBackground(),
    featuresBeta: runInBackground(),
    tags: runInBackground(),
    collections: runInBackground(),
    copyPaster: runInBackground(),
    readablePageArchives: runInBackground(),
    contentSharing: runInBackground(),
    personalCloud: runInBackground(),
    pdf: runInBackground(),
}

export const notifications = remoteFunctions.notifications
export const bookmarks = remoteFunctions.bookmarks
export const auth = remoteFunctions.auth
export const subscription = remoteFunctions.subscription
// export const features = remoteFunctions.features
export const features = {} as any
export const featuresBeta = remoteFunctions.featuresBeta
export const tags = remoteFunctions.tags
export const collections = remoteFunctions.collections
export const copyPaster = remoteFunctions.copyPaster
export const readable = remoteFunctions.readablePageArchives
export const contentSharing = remoteFunctions.contentSharing
export const annotations = runInBackground<AnnotationInterface<'caller'>>()
export const pdf = remoteFunctions.pdf
