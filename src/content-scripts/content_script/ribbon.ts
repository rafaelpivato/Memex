import browser from 'webextension-polyfill'

import { IGNORE_CLICK_OUTSIDE_CLASS } from '../constants'
import { ContentScriptRegistry, RibbonScriptMain } from './types'
import { setupRibbonUI, destroyRibbonUI } from 'src/in-page-ui/ribbon/react'
import { createInPageUI, destroyInPageUI } from 'src/in-page-ui/utils'
import { setSidebarState, getSidebarState } from 'src/sidebar-overlay/utils'

export const main: RibbonScriptMain = async (options) => {
    const cssFile = browser.runtime.getURL(`/content_script_ribbon.css`)
    let mount: ReturnType<typeof createInPageUI> | null = null
    const createMount = () => {
        if (!mount) {
            mount = createInPageUI('ribbon', cssFile, [
                IGNORE_CLICK_OUTSIDE_CLASS,
            ])
        }
    }
    createMount()

    options.inPageUI.events.on('componentShouldSetUp', ({ component }) => {
        if (component === 'ribbon') {
            setUp()
        }
    })
    options.inPageUI.events.on('componentShouldDestroy', ({ component }) => {
        if (component === 'ribbon') {
            destroy()
        }
    })

    const setUp = async () => {
        createMount()
        setupRibbonUI(mount.rootElement, {
            containerDependencies: {
                ...options,
                currentTab: (await browser.tabs?.getCurrent()) ?? {
                    id: undefined,
                    url: await options.getPageUrl(),
                },
                setSidebarEnabled: setSidebarState,
                getSidebarEnabled: getSidebarState,
            },
            inPageUI: options.inPageUI,
        })
    }

    const destroy = () => {
        if (!mount) {
            return
        }

        destroyInPageUI('ribbon')
        destroyRibbonUI(mount.rootElement, mount.shadowRoot)
    }
}

const registry = globalThis['contentScriptRegistry'] as ContentScriptRegistry
registry.registerRibbonScript(main)
