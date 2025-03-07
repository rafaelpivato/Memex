import React from 'react'
import { connect, MapStateToProps } from 'react-redux'

import { runInBackground } from 'src/util/webextensionRPC'
import { selectors as notifs } from '../../../notifications'
import { selectors as filters } from 'src/search-filters'
import NoResultBadTerm from './NoResultBadTerm'
import ResultsMessage from './results-message'
import ResultList from './ResultListContainer'
import DeprecatedSearchWarning, {
    shouldShowDeprecatedSearchWarning,
} from './DeprecatedSearchWarning'
import SearchTypeSwitch from './search-type-switch'
import * as actions from '../actions'
import * as selectors from '../selectors'
import { RootState } from 'src/options/types'
import { features } from 'src/util/remote-functions-background'
import MobileAppMessage from './mobile-app-message'
import { AnnotationInterface } from 'src/annotations/background/types'
import { Annotation } from 'src/annotations/types'
import { setLocalStorage } from 'src/util/storage'
import { DEPRECATED_SEARCH_WARNING_KEY } from 'src/overview/constants'
import { ContentSharingInterface } from 'src/content-sharing/background/types'
import { RemoteCopyPasterInterface } from 'src/copy-paster/background/types'
import styled from 'styled-components'
import * as icons from 'src/common-ui/components/design-library/icons'
import Icon from '@worldbrain/memex-common/lib/common-ui/components/icon'

const styles = require('./ResultList.css')

export interface StateProps {
    noResults: boolean
    isBadTerm: boolean
    isLoading: boolean
    showInbox: boolean
    isMobileListFiltered: boolean
    areAnnotationsExpanded: boolean
    showOnboardingMessage: boolean
    shouldShowCount: boolean
    isInvalidSearch: boolean
    showInitSearchMsg: boolean
    totalResultCount: number
}

export interface DispatchProps {
    toggleAreAnnotationsExpanded: (e: React.SyntheticEvent) => void
}

export interface OwnProps {
    toggleAnnotationsSidebar(args: { pageUrl: string; pageTitle: string }): void
    handleReaderViewClick: (url: string) => void
    contentSharing: ContentSharingInterface
    copyPaster: RemoteCopyPasterInterface
}

export type Props = StateProps & DispatchProps & OwnProps

interface State {
    showSocialSearch: boolean
    showDeprecatedSearchWarning: boolean
}

class ResultsContainer extends React.Component<Props, State> {
    state: State = {
        showSocialSearch: false,
        showDeprecatedSearchWarning: false,
    }

    private annotations: AnnotationInterface<'caller'>

    constructor(props) {
        super(props)

        this.annotations = runInBackground<AnnotationInterface<'caller'>>()
    }

    async componentDidMount() {
        this.setState({
            showDeprecatedSearchWarning: await shouldShowDeprecatedSearchWarning(),
            showSocialSearch: await features.getFeature('SocialIntegration'),
        })
    }

    private handleHideDeprecatedSearchWarning = async () => {
        this.setState({ showDeprecatedSearchWarning: false })
        await setLocalStorage(DEPRECATED_SEARCH_WARNING_KEY, false)
    }

    private goToAnnotation = async (annotation: Annotation) => {
        await this.annotations.goToAnnotationFromSidebar({
            url: annotation.pageUrl,
            annotation,
        })
    }

    private getOnboardingStatus = async () => {
        const onboardingStage = await localStorage.getItem('stage.Onboarding')

        return onboardingStage
    }

    private renderContent = async () => {
        const showOnboarding = await this.getOnboardingStatus()
        const showMobileAd = localStorage.getItem('stage.MobileAppAd') ?? 'true'

        if (this.props.isMobileListFiltered && this.props.noResults) {
            return (
                <ResultsMessage>
                    <NoResultBadTerm title="You don't have anything saved from the mobile app yet">
                        {showMobileAd === 'true' && <MobileAppMessage />}
                    </NoResultBadTerm>
                </ResultsMessage>
            )
        }

        if (showOnboarding && this.props.noResults) {
            return (
                <ResultsMessage>
                    <SectionCircle>
                        <Icon
                            filePath={icons.heartEmpty}
                            heightAndWidth="24px"
                            color="purple"
                            hoverOff
                        />
                    </SectionCircle>
                    <NoResultBadTerm
                        title={
                            <span>
                                Save your first website or{' '}
                                <ImportInfo
                                    onClick={() => {
                                        localStorage.setItem(
                                            'stage.Onboarding',
                                            'false',
                                        )
                                        window.location.hash = '#/import'
                                    }}
                                >
                                    import your bookmarks.
                                </ImportInfo>
                            </span>
                        }
                    >
                        {/* <OnboardingMessage /> */}
                    </NoResultBadTerm>
                </ResultsMessage>
            )
        }

        if (this.props.isBadTerm) {
            return (
                <ResultsMessage>
                    <NoResultBadTerm>
                        Search terms are too common, or have been filtered out
                        to increase performance.
                    </NoResultBadTerm>
                </ResultsMessage>
            )
        }

        if (this.props.isInvalidSearch) {
            return (
                <ResultsMessage>
                    <NoResultBadTerm title="Invalid search query">
                        You can't exclude terms without including at least 1
                        term to search
                    </NoResultBadTerm>
                </ResultsMessage>
            )
        }

        if (this.props.noResults) {
            return (
                <ResultsMessage>
                    <NoResultBadTerm>¯\_(ツ)_/¯</NoResultBadTerm>
                </ResultsMessage>
            )
        }

        // No issues; render out results list view
        return (
            <React.Fragment>
                {this.props.shouldShowCount && (
                    <ResultsMessage small>
                        {this.props.totalResultCount} results
                    </ResultsMessage>
                )}
                <ResultList
                    {...this.props}
                    handleReaderViewClick={this.props.handleReaderViewClick}
                    goToAnnotation={this.goToAnnotation}
                />
            </React.Fragment>
        )
    }

    private renderDeprecatedSearchWarning() {
        if (!this.state.showDeprecatedSearchWarning) {
            return null
        }

        return (
            <DeprecatedSearchWarning
                onCancelBtnClick={this.handleHideDeprecatedSearchWarning}
                onInfoBtnClick={() =>
                    window.open(
                        'https://worldbrain.io/announcements/search-deprecation',
                    )
                }
            />
        )
    }

    render() {
        return (
            <div className={styles.main}>
                <SearchTypeSwitch
                    copyPaster={this.props.copyPaster}
                    showSocialSearch={this.state.showSocialSearch}
                />
                {this.renderDeprecatedSearchWarning()}
                {this.renderContent()}
            </div>
        )
    }
}

const mapState: MapStateToProps<StateProps, OwnProps, RootState> = (state) => ({
    showInbox: notifs.showInbox(state),
    noResults: selectors.noResults(state),
    isBadTerm: selectors.isBadTerm(state),
    isLoading: selectors.isLoading(state),
    areAnnotationsExpanded: selectors.areAnnotationsExpanded(state),
    isMobileListFiltered: filters.isMobileListFiltered(state),
    shouldShowCount: selectors.shouldShowCount(state),
    isInvalidSearch: selectors.isInvalidSearch(state),
    totalResultCount: selectors.totalResultCount(state),
    showInitSearchMsg: selectors.showInitSearchMsg(state),
    showOnboardingMessage: selectors.showOnboardingMessage(state),
})

const mapDispatch: (dispatch, props: OwnProps) => DispatchProps = (
    dispatch,
) => ({
    toggleAreAnnotationsExpanded: (e) => {
        e.preventDefault()
        dispatch(actions.toggleAreAnnotationsExpanded())
    },
})

const SectionCircle = styled.div`
    background: ${(props) => props.theme.colors.backgroundColor};
    border-radius: 100px;
    height: 60px;
    width: 60px;
    margin-bottom: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
`

const ImportInfo = styled.div`
    color: ${(props) => props.theme.colors.purple};
    font-size: 14px;
    margin-bottom: 40px;
    font-weight: 500;
`

export default connect(mapState, mapDispatch)(ResultsContainer)
