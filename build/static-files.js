import { buildingManifestV3 } from './util'

/**
 * Everything in here gets injected into the generated HTML as link/script tags.
 * See: https://github.com/jharris4/html-webpack-include-assets-plugin#example
 */
export const htmlAssets = ['fonts/Inter/inter.css', 'lib/browser-polyfill.js']

/**
 * Set the manifest version to be equal to `package.json` version.
 */
function transformManifestVersion(content) {
    const manifest = JSON.parse(content.toString())
    manifest.version = process.env.npm_package_version
    return Buffer.from(JSON.stringify(manifest))
}
/**
 * Set the manifest version to be equal to `package.json` version.
 */
function injectContentScripts(content) {
    return Buffer.from(
        content.toString().replace(
            `</body>`,
            `
        <script src="../lib/browser-polyfill.js"></script>
        <script src="../content_script_pdfjs.js"></script>
        </body>
    `,
        ),
    )
}

/**
 * Everything in here gets copied as-is to the output dir.
 * See: https://github.com/webpack-contrib/copy-webpack-plugin#usage
 */
export const copyPatterns = [
    {
        from: buildingManifestV3 ? 'src/manifest-v3.json' : 'src/manifest.json',
        to: './manifest.json',
        transform: transformManifestVersion,
    },
    { from: 'img', to: 'img' },
    {
        from: 'node_modules/webextension-polyfill/dist/browser-polyfill.js',
        to: 'lib/',
    },

    {
        from: 'node_modules/pdfjs-dist/web/viewer.css',
        to: 'pdfjs/',
    },
    {
        from: 'node_modules/pdfjs-dist/web/viewer.js',
        to: 'pdfjs/',
    },
    {
        from: 'node_modules/pdfjs-dist/web/viewer.html',
        to: 'pdfjs/',
        transform: injectContentScripts,
    },
    {
        from: 'node_modules/pdfjs-dist/web/locale/en-US/viewer.properties',
        to: 'pdfjs/locale/locale.properties',
    },
    {
        from: 'node_modules/pdfjs-dist/web/locale/en-US/viewer.properties',
        to: 'pdfjs/',
    },
    {
        from: 'node_modules/pdfjs-dist/web/images/*',
        to: 'pdfjs/images/[name].[ext]',
    },

    { from: 'node_modules/pdfjs-dist/build/pdf.js', to: 'build/' },
    { from: 'node_modules/pdfjs-dist/build/pdf.worker.js', to: 'build/' },
    {
        from: 'node_modules/pdfjs-dist/build/pdf.worker.js',
        to: 'build/pdf.worker.min.js',
    },

    {
        from: 'fonts/*/*',
        to: 'fonts/[name].[ext]',
    },
    {
        from: 'fonts/Inter/*',
        to: 'fonts/Inter/[name].[ext]',
    },
    {
        from:
            'node_modules/material-design-icons/iconfont/*.{eot,ttf,woff,woff2,css}',
        to: 'fonts/material-icons/[name].[ext]',
        toType: 'template',
    },
]
