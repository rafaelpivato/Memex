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


export default class ReadwiseSettings extends StatefulUIElement<
    ReadwiseSettingsDependencies,
    ReadwiseSettingsState,
    ReadwiseSettingsEvent
> {
    constructor(props: ReadwiseSettingsDependencies) {
        super(props, new ReadwiseSettingsLogic(props))
    }

    renderSyncing() {
        return (
            <div>
                {selectors.showSyncError(this.state) && (
                    <div>
                        Something went wrong syncing your existing
                        annotations...
                    </div>
                )}
                {selectors.showSyncRunning(this.state) && (
                    <div>Syncing your existing annotations...</div>
                )}
            </div>
        )
    }

    renderForm() {
        return (
            <div>
                {!selectors.showKeyRemoveButton(this.state) && (
                    <SuccessMessage>
                        <span>Automatically push all your highlights to Readwise.</span>
                        <div>Here you can get the <a target="_blank" href='https://readwise.io/access_token'>API key</a>.</div>
                    </SuccessMessage>
                )}
                {selectors.showKeySaveError(this.state) && (
                    <ErrorMessage>{selectors.keySaveErrorMessage(this.state)}</ErrorMessage>
                )}
                {selectors.showKeySuccessMessage(this.state) && (
                    <SuccessMessage>
                        Your ReadWise integration is now active! <br/>
                        Any annotation you make from now on is immediately uploaded.
                    </SuccessMessage>
                )}
                {selectors.showSyncSuccessMessage(this.state) && (
                    <SuccessMessage>
                        Your ReadWise integration is now active! <br/>
                        Existing annotations are uploaded and every new one you make too.
                    </SuccessMessage>
                )}
                <MainBox>
                    <KeyBox
                        type="text"
                        placeholder="ReadWise API key"
                        disabled={selectors.apiKeyDisabled(this.state)}
                        value={selectors.showKeySaving(this.state) ? ("Saving API key..."):(this.state.apiKey || '')} 
                        onChange={(e) =>
                            this.processEvent('setAPIKey', {
                                key: e.target.value,
                            })
                        }
                    />
                    {selectors.showKeySaveButton(this.state) && (
                        <div>
                            <PrimaryAction
                                onClick={() =>
                                    this.processEvent('saveAPIKey', null)
                                }
                                label={'Confirm'}
                            />
                        </div>
                    )}
                    {selectors.showKeyRemoveButton(this.state) && (
                        <SecondaryAction
                            onClick={() =>
                                this.processEvent('removeAPIKey', null)
                            }
                            label={'Remove'}
                        />
                    )}
                </MainBox>
                {selectors.formEditable(this.state) && (
                    <ExistingHighlightBox>
                        <Checkbox
                            id='Existing Highlight Settings'
                            isChecked={this.state.syncExistingNotes ?? false}
                            handleChange={(e) =>
                                this.processEvent(
                                    'toggleSyncExistingNotes',
                                    null,
                                )
                            }
                        />{' '}
                        Sync existing higlights
                    </ExistingHighlightBox>
                )}
            </div>
        )
    }

    render() {
        if (selectors.showForm(this.state)) {
            return this.renderForm()
        }
        if (selectors.showSyncScreen(this.state)) {
            return this.renderSyncing()
        }
        if (selectors.showLoadingError(this.state)) {
            return 'Something went wrong loading your ReadWise.io settings'
        }
    }
}

const KeyBox = styled.input`
    background: #e0e0e0;
    border-radius: 3px;
    padding: 5px 10px;
    border: none
    width: 100%;
    outline: none;
    height: 36px;
    margin-left: 0;
`

const MainBox = styled.div`
    display: flex;
    margin-top: 10px;
    justify-content: space-between;
`

const ExistingHighlightBox = styled.div`
    display: flex;
    margin: 10px 0px;
    font-size: 14px;
    color: 3a2f45;
    align-items: center;
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
    margin: 10px 0px;
    font-size: 14px;
    border-radius: 3px;
    border: none;
    justify-content: flex-start;
    color: #3a2f45;
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
