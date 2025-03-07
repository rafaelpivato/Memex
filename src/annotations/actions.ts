import { createAction } from 'redux-act'
import { Thunk } from 'src/sidebar-overlay/types'
import * as selectors from 'src/sidebar-overlay/sidebar/selectors'
import { RES_PAGE_SIZE } from 'src/sidebar-overlay/sidebar/constants'
import { AnnotSearchParams } from 'src/search/background/types'
import { normalizeUrl } from '@worldbrain/memex-url-utils'
import {
    nextResultsPage,
    setIsLoading,
    setResultsExhausted,
} from 'src/sidebar-overlay/sidebar/actions'
import { Annotation } from 'src/annotations/types'

export const setAnnotations = createAction<Annotation[]>('setAnnotations')
export const appendAnnotations = createAction<Annotation[]>(
    'sidebar/appendAnnotations',
)

export const fetchMoreAnnotationsForPageUrl: (
    isSocialPost?: boolean,
) => Thunk = (isSocialPost) => async (dispatch, getState) => {
    dispatch(setIsLoading(true))

    const state = getState()
    const annotationsManager = selectors.annotationsManager(state)
    const { url } = selectors.page(state)
    const currentPage = selectors.currentPage(state)

    if (annotationsManager) {
        const annotations = await annotationsManager.fetchAnnotationsWithTags(
            url,
            // RES_PAGE_SIZE,
            // currentPage * RES_PAGE_SIZE,
            isSocialPost,
        )
        annotations.reverse()
        dispatch(appendAnnotations(annotations))
        dispatch(nextResultsPage())
        dispatch(setResultsExhausted(annotations.length < RES_PAGE_SIZE))
    }

    dispatch(setIsLoading(false))
}

/* export const updateAnnotationState: (
    isSocialPost?: boolean,
) => Thunk = (annotationId, annotation) => async (dispatch, getState) => {
    const state = getState()
    const annotationsManager = selectors.annotationsManager(state)
    const { url } = selectors.page(state)
    dispatch(setAnnotations({ ...state., annotation }))
} */

export const editAnnotation: (
    url: string,
    comment: string,
    tags: string[],
) => Thunk = (url, comment, tags) => async (dispatch, getState) => {
    const state = getState()
    const annotationsManager = selectors.annotationsManager(state)
    const annotations = selectors.annotations(state)
    const index = annotations.findIndex((annot) => annot.url === url)

    let annotation
    let body
    if (index !== -1) {
        annotation = annotations[index]
        body = annotation.body
    } else {
        /* In the case of user trying to edit the annotation from the results list.
        The sidebar isn't loaded, so the annotations aren't present in the sidebar's
        state. So the action just returns after saving the annotation. */
        if (annotationsManager) {
            await annotationsManager.editAnnotation({ url, comment, tags })
        }
        return
    }

    // Check that annotation isn't completely empty.
    if ((!body || !body.length) && !comment.length && !tags.length) {
        return
    }

    if (annotationsManager) {
        // Let annotationsManager handle editing the annotation in the storage.
        await annotationsManager.editAnnotation({ url, comment, tags })

        // Edit the annotation in Redux store.
        const newAnnotations = [
            ...annotations.slice(0, index),
            { ...annotation, comment, tags, lastEdited: Date.now() },
            ...annotations.slice(index + 1),
        ]
        dispatch(setAnnotations(newAnnotations))
    }
}
export const deleteAnnotation: (url: string) => Thunk = (url) => async (
    dispatch,
    getState,
) => {
    const state = getState()
    const annotationsManager = selectors.annotationsManager(state)
    const annotations = selectors.annotations(state)

    if (annotationsManager) {
        await annotationsManager.deleteAnnotation(url)
        const newAnnotations = annotations.filter((annot) => annot.url !== url)
        dispatch(setAnnotations(newAnnotations))
    }
}
export const searchAnnotations: () => Thunk = () => async (
    dispatch,
    getState,
) => {
    dispatch(setIsLoading(true))

    const state = getState()
    let { url } = selectors.page(state)

    url = url ? url : globalThis.location.href

    if (selectors.pageType(state) !== 'page') {
        dispatch(setIsLoading(false))
        return
    }

    const searchParams: AnnotSearchParams = {
        query: state.searchBar.query,
        startDate: state.searchBar.startDate,
        endDate: state.searchBar.endDate,
        bookmarksOnly: state.searchFilters.onlyBookmarks,
        tagsInc: state.searchFilters.tags,
        tagsExc: state.searchFilters.tagsExc,
        domainsInc: state.searchFilters.domainsInc,
        domainsExc: state.searchFilters.domainsExc,
        limit: RES_PAGE_SIZE,
        collections: [state.searchFilters.lists],
        url,
    }

    const annotationsManager = selectors.annotationsManager(state)
    const annotations: Annotation[] = []

    if (annotationsManager) {
        const annotSearchResult = await annotationsManager.searchAnnotations(
            searchParams,
        )

        if (!searchParams.query) {
            const { annotsByDay } = annotSearchResult

            const sortedKeys = Object.keys(annotsByDay).sort().reverse()

            for (const day of sortedKeys) {
                const cluster = annotsByDay[day]
                for (const pageUrl of Object.keys(cluster)) {
                    if (pageUrl === normalizeUrl(searchParams.url)) {
                        annotations.push(...cluster[pageUrl])
                    }
                }
            }
        } else {
            const { docs } = annotSearchResult

            for (const doc of docs) {
                if (doc.url === normalizeUrl(searchParams.url)) {
                    annotations.push(...doc.annotations)
                }
            }
        }

        dispatch(setAnnotations(annotations))
        dispatch(setResultsExhausted(annotSearchResult.resultsExhausted))
    }

    dispatch(setIsLoading(false))
}
