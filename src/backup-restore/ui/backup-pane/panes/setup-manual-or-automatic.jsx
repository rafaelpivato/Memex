import React from 'react'
import PropTypes from 'prop-types'
import OnboardingBackupMode from '../components/onboarding-backup-mode'
import Styles from '../../styles.css'
import { withCurrentUser } from 'src/authentication/components/AuthConnector'
import { PrimaryAction } from 'src/common-ui/components/design-library/actions/PrimaryAction'
import { SecondaryAction } from 'src/common-ui/components/design-library/actions/SecondaryAction'
import { connect } from 'react-redux'
import { show } from 'src/overview/modals/actions'

const settingsStyle = require('src/options/settings/components/settings.css')

class SetupManualOrAutomatic extends React.Component {
    state = {
        mode: 'automatic',
        automatic: true,
    }

    render() {
        return (
            <div>
                <div className={settingsStyle.section}>
                    <div className={settingsStyle.sectionTitle}>
                        <strong>STEP 2/5: </strong>
                        More or less work?
                    </div>
                    <OnboardingBackupMode
                        className={Styles.selectionlist}
                        onModeChange={(mode) => this.setState({ mode })}
                        showSubscriptionModal={this.props.showSubscriptionModal}
                        isAuthorizedForAutomaticBackup={this.state.automatic}
                    />
                    <div className={settingsStyle.buttonArea}>
                        <SecondaryAction
                            onClick={this.props.onBackRequested}
                            label={'Go Back'}
                        />
                        <div>
                            {this.state.mode === 'manual' && (
                                <PrimaryAction
                                    onClick={() =>
                                        this.props.onChoice({ type: 'manual' })
                                    }
                                    label={'Continue'}
                                />
                            )}
                            {this.state.mode === 'automatic' && (
                                <PrimaryAction
                                    disabled={false}
                                    onClick={() =>
                                        this.props.onChoice({
                                            type: 'automatic',
                                        })
                                    }
                                    label={'Next'}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default connect(null, (dispatch) => ({
    showSubscriptionModal: () => dispatch(show({ modalId: 'Subscription' })),
}))(withCurrentUser(SetupManualOrAutomatic))

SetupManualOrAutomatic.propTypes = {
    onChoice: PropTypes.func.isRequired,
    onBackRequested: PropTypes.func.isRequired,
    showSubscriptionModal: PropTypes.func.isRequired,
    // currentUser: PropTypes.object.isRequired,
}
