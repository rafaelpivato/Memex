import React from 'react'
import styled from 'styled-components'

import { StatefulUIElement } from 'src/util/ui-logic'
import ReadwiseSettingsLogic from './logic'
import {
    ReadwiseSettingsDependencies,
    ReadwiseSettingsEvent,
    ReadwiseSettingsState,
} from './types'
import * as selectors from './selectors'
import { Checkbox } from 'src/common-ui/components'

import { SecondaryAction } from 'src/common-ui/components/design-library/actions/SecondaryAction'
import { PrimaryAction } from 'src/common-ui/components/design-library/actions/PrimaryAction'
import { connect } from 'react-redux'
import { show } from 'src/overview/modals/actions'
import { withCurrentUser } from 'src/authentication/components/AuthConnector'
import { runInBackground } from 'src/util/webextensionRPC'
import { ReadwiseInterface } from 'src/readwise-integration/background/types/remote-interface'
import { AuthContextInterface } from 'src/authentication/background/types'
import { userAuthorizedForReadwise } from './utils'
import analytics from 'src/analytics'

class ReadwiseSettingsContainer extends React.Component<
    AuthContextInterface & { showSubscriptionModal: () => void }
> {
    render() {
        return (
            <ReadwiseSettings
                readwise={runInBackground<ReadwiseInterface<'caller'>>()}
                checkFeatureAuthorized={async () =>
                    userAuthorizedForReadwise(this.props.currentUser)
                }
                showSubscriptionModal={this.props.showSubscriptionModal}
            />
        )
    }
}

class ReadwiseSettings extends StatefulUIElement<
    ReadwiseSettingsDependencies,
    ReadwiseSettingsState,
    ReadwiseSettingsEvent
> {
    constructor(props: ReadwiseSettingsDependencies) {
        super(props, new ReadwiseSettingsLogic(props))
    }

    renderUnauthorized() {
        return (
            <MainBox>
                <SuccessMessage>
                    Subscribe to a paid plan to automatically sync all your
                    highlights to ReadWise.io
                </SuccessMessage>
                <PrimaryAction
                    label="Subscribe"
                    onClick={() =>
                        this.processEvent('showSubscriptionModal', null)
                    }
                />
            </MainBox>
        )
    }

    renderSyncScreen() {
        return (
            <div>
                {selectors.showSyncError(this.state) && (
                    <ErrorMessage>
                        Something went wrong syncing your existing
                        annotations...
                    </ErrorMessage>
                )}
                {selectors.showSyncRunning(this.state) && (
                    <SuccessMessage>
                        Syncing your existing annotations...
                    </SuccessMessage>
                )}
            </div>
        )
    }

    confirmSyncKey() {
        this.processEvent('saveAPIKey', null)

        analytics.trackEvent({
            category: 'Readwise',
            action: 'setupReadwise',
        })
    }

    removeSyncKey() {
        this.processEvent('removeAPIKey', null)

        analytics.trackEvent({
            category: 'Readwise',
            action: 'removeReadwise',
        })
    }

    renderForm() {
        return (
            <div>
                {!selectors.showKeyRemoveButton(this.state) && (
                    <SuccessMessage>
                        <span>
                            Automatically push all your highlights to Readwise.
                        </span>
                        <div>
                            Here you can get the{' '}
                            <a
                                target="_blank"
                                href="https://readwise.io/access_token"
                            >
                                API key
                            </a>
                            .
                        </div>
                    </SuccessMessage>
                )}
                {selectors.formEditable(this.state) && (
                    <ExistingHighlightBox>
                        <Checkbox
                            id="Existing Highlight Settings"
                            isChecked={this.state.syncExistingNotes ?? false}
                            handleChange={(e) =>
                                this.processEvent(
                                    'toggleSyncExistingNotes',
                                    null,
                                )
                            }
                        />{' '}
                        Sync existing highlights
                    </ExistingHighlightBox>
                )}
                {selectors.showKeySaveError(this.state) && (
                    <ErrorMessage>
                        {selectors.keySaveErrorMessage(this.state)}
                    </ErrorMessage>
                )}
                {selectors.showKeySuccessMessage(this.state) && (
                    <SuccessMessage>
                        Your ReadWise integration is now active! <br />
                        Any annotation you make from now on is immediately
                        uploaded.
                    </SuccessMessage>
                )}
                {selectors.showSyncSuccessMessage(this.state) && (
                    <SuccessMessage>
                        Your ReadWise integration is now active! <br />
                        Existing annotations are uploaded and every new one you
                        make too.
                    </SuccessMessage>
                )}
                <MainBox>
                    <KeyBox
                        type="text"
                        placeholder="ReadWise API key"
                        disabled={selectors.apiKeyDisabled(this.state)}
                        value={
                            selectors.showKeySaving(this.state)
                                ? 'Saving API key...'
                                : this.state.apiKey || ''
                        }
                        onChange={(e) =>
                            this.processEvent('setAPIKey', {
                                key: e.target.value,
                            })
                        }
                    />
                    {selectors.showKeySaveButton(this.state) && (
                        <div>
                            <PrimaryAction
                                onClick={() => this.confirmSyncKey()}
                                label={'Confirm'}
                            />
                        </div>
                    )}
                    {selectors.showKeyRemoveButton(this.state) && (
                        <SecondaryAction
                            onClick={() => this.removeSyncKey()}
                            label={'Remove'}
                        />
                    )}
                </MainBox>
            </div>
        )
    }

    render() {
        return (
            <>
                {selectors.showSyncScreen(this.state) &&
                    this.renderSyncScreen()}
                {selectors.showForm(this.state) && this.renderForm()}
                {selectors.showLoadingError(this.state) &&
                    'Something went wrong loading your ReadWise.io settings'}
            </>
        )
    }
}

export default connect(null, (dispatch) => ({
    showSubscriptionModal: () => dispatch(show({ modalId: 'Subscription' })),
}))(withCurrentUser(ReadwiseSettingsContainer))

const KeyBox = styled.input`
    background: ${(props) => props.theme.colors.backgroundColor};
    border-radius: 3px;
    padding: 5px 10px;
    border: none;
    width: 100%;
    outline: none;
    height: 36px;
    margin-left: 0;
    margin-right: 15px;
    border: 1px solid ${(props) => props.theme.colors.lineLightGrey};
`

const MainBox = styled.div`
    display: flex;
    margin-top: 10px;
    justify-content: space-between;
`

const ExistingHighlightBox = styled.div`
    display: flex;
    margin: 10px 0px 20px;
    font-size: 14px;
    align-items: center;
    color: ${(props) => props.theme.colors.darkerText};
`

const ErrorMessage = styled.div`
    display: flex;
    margin-top: 10px;
    background: #f29d9d;
    font-size: 14px;
    border-radius: 3px;
    border: none;
    justify-content: center;
    height: 30px;
    color: 3a2f45;
    align-items: center;
`

const SuccessMessage = styled.div`
    display: flex;
    margin: 10px 0px 20px 0px;
    font-size: 14px;
    border-radius: 3px;
    border: none;
    justify-content: flex-start;
    color: ${(props) => props.theme.colors.normalText};
    flex-direction: column;
`

const Container = styled.div`
    position: absolute;
    z-index: 2500;
    background: #f29d9d;
    top: 70px;
    border-radius: 5px;
    padding: 10px 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 90%;
    max-width: 800px;
`
