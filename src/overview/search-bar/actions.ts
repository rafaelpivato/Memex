import { createAction } from 'redux-act'
import { HASH_TAG_PATTERN } from '@worldbrain/memex-common/lib/storage/constants'

import { remoteFunction } from '../../util/webextensionRPC'
import analytics from '../../analytics'
import { Thunk } from '../../options/types'
import * as constants from './constants'
import * as selectors from './selectors'
import { acts as resultsActs, selectors as results } from '../results'
import {
    actions as filterActs,
    selectors as filters,
} from '../../search-filters'
import { actions as notifActs } from '../../notifications'
import * as Raven from 'src/util/raven'
import { auth } from 'src/util/remote-functions-background'
import { stripTagPattern, splitInputIntoTerms } from './utils'
import { BackgroundSearchParams } from 'src/search/background/types'

const pageSearchRPC = remoteFunction('searchPages')
const annotSearchRPC = remoteFunction('searchAnnotations')
const socialSearchRPC = remoteFunction('searchSocial')

export const setQuery = createAction<string>('header/setQuery')
export const setStartDate = createAction<number>('header/setStartDate')
export const setEndDate = createAction<number>('header/setEndDate')
export const setStartDateText = createAction<string>('header/setStartDateText')
export const setEndDateText = createAction<string>('header/setEndDateText')
export const clearFilters = createAction('header/clearFilters')

export const setQueryTagsDomains: (
    input: string,
    isEnter?: boolean,
) => Thunk = (input, isEnter = true) => (dispatch, getState) => {
    const state = getState()

    if (input[input.length - 1] === ' ' || isEnter) {
        const terms = splitInputIntoTerms(input)

        terms.forEach((term) => {
            // If '#tag' pattern in input, and not already tracked, add to filter state
            if (
                HASH_TAG_PATTERN.test(term) &&
                !filters.tags(state).includes(stripTagPattern(term))
            ) {
                dispatch(filterActs.toggleTagFilter(stripTagPattern(term)))
                analytics.trackEvent({
                    category: 'SearchFilters',
                    action: 'addTagFilterViaQuery',
                })
            }

            // If 'domain.tld.cctld?' pattern in input, and not already tracked, add to filter state
            if (constants.DOMAIN_TLD_PATTERN.test(term)) {
                let act
                let currentState

                // Choose to exclude or include domain, basead on pattern
                if (constants.EXCLUDE_PATTERN.test(term)) {
                    currentState = filters.domainsExc(state)
                    act = filterActs.toggleExcDomainFilter
                } else {
                    currentState = filters.domainsInc(state)
                    act = filterActs.toggleIncDomainFilter
                }

                term = term.replace(constants.TERM_CLEAN_PATTERN, '')
                if (currentState.includes(term)) {
                    return
                }

                dispatch(act(term))

                analytics.trackEvent({
                    category: 'SearchFilters',
                    action: 'addDomainFilterViaQuery',
                })
            }
        })
    }

    dispatch(resultsActs.setLoading(true))
    dispatch(setQuery(input))
}

/**
 * Perform a search using the current query params as defined in state. Pagination
 * state will also be used to perform relevant pagination logic.
 *
 * @param [overwrite=false] Denotes whether to overwrite existing results or just append.
 * @param [fromOverview=true] Denotes whether search is done from overview or inpage.
 */
export const search: (args?: any) => Thunk = (
    { fromOverview, overwrite } = { fromOverview: true, overwrite: false },
) => async (dispatch, getState) => {
    const firstState = getState()
    const query = selectors.query(firstState)
    const startDate = selectors.startDate(firstState)
    const endDate = selectors.endDate(firstState)

    dispatch(resultsActs.resetActiveSidebarIndex())
    dispatch(resultsActs.setLoading(true))

    // if (showTooltip) {
    //     dispatch(fetchNextTooltip())
    // }

    // Overwrite of results should always reset the current page before searching
    if (overwrite) {
        dispatch(resultsActs.resetPage())
        dispatch(resultsActs.resetSearchResult())
    }

    if (/thank you/i.test(query)) {
        return dispatch(resultsActs.easter())
    }

    // Grab needed derived state for search
    const state = getState()
    const searchParams: BackgroundSearchParams = {
        query,
        startDate,
        endDate,
        showOnlyBookmarks: filters.onlyBookmarks(state),
        tagsInc: filters.tags(state),
        tagsExc: filters.tagsExc(state),
        domains: filters.domainsInc(state),
        domainsExclude: filters.domainsExc(state),
        limit: constants.PAGE_SIZE,
        skip: results.resultsSkip(state),
        lists: filters.listFilterParam(state),
        contentTypes: filters.contentType(state),
        usersInc: filters.usersInc(state),
        usersExc: filters.usersExc(state),
        hashtagsInc: filters.hashtagsInc(state),
        hashtagsExc: filters.hashtagsExc(state),
    }

    try {
        const searchRPC = results.isSocialPost(state)
            ? socialSearchRPC
            : results.isAnnotsSearch(state)
            ? annotSearchRPC
            : pageSearchRPC

        // Tell background script to search
        const searchResult = await searchRPC(searchParams)
        dispatch(resultsActs.updateSearchResult({ overwrite, searchResult }))

        if (searchResult.docs.length) {
            dispatch(resultsActs.incSearchCount())
        }
    } catch (error) {
        console.error(`Search for '${query}' errored: ${error.toString()}`)
        Raven.captureException(error)
        dispatch(resultsActs.setLoading(false))
    }
}

export const init = () => (dispatch) => {
    dispatch(notifActs.updateUnreadNotif())
    dispatch(search({ overwrite: true, fromOverview: false }))

    const getFeatures = async () => {
        if (await auth.isAuthorizedForFeature('beta')) {
            dispatch(resultsActs.setBetaFeatures(true))
        }
    }
    getFeatures()
}
