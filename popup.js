const options = {
    include_media: false,
    include_website_links: false,

    filter_regex: null,

    filter_name: '',
    filter_name_exclude: '',

    filter_ext: '',
    filter_ext_exclude: '',

    filters: {
        name: [],
        name_exclude: [],

        ext: [],
        ext_exclude: []
    },

    download_subdirectory: '',
    download_overwrite: false,
    download_custom_name: false,
    download_select_location: false,

    use_link_text: false
}

const elements = {
    status: document.getElementById('status'),
    download_status: document.getElementById('download_status')
        .firstElementChild,
    controls: document.getElementById('controls'),
    actions: document.getElementById('actions'),
    list: document.getElementById('list')
}

const fileEntryElementPool = []

const fileExtRegex = new RegExp(/\.([0-9a-z]+)(?:[\?#]|$)/i)
const dotRegex = new RegExp(/\./)
const invalidPathRegex = new RegExp(/:[\\\/]/)
const newlineRegex = new RegExp(/\n/g)

const sortFns = {
    domain: (a, b) => a.domain.localeCompare(b.domain),
    domain_r: (a, b) => b.domain.localeCompare(a.domain),

    url: (a, b) => a.url.localeCompare(b.url),
    url_r: (a, b) => b.url.localeCompare(a.url),

    name: (a, b) => (a.name || a.urlName).localeCompare(b.name || b.urlName),
    name_r: (a, b) => (b.name || b.urlName).localeCompare(a.name || b.urlName),

    ext: (a, b) => a.ext.localeCompare(b.ext),
    ext_r: (a, b) => b.ext.localeCompare(a.ext)
}

let activeTabUrl = null
let activeTabId = null

let webFileTypes = [
    'asp',
    'aspx',
    'axd',
    'asx',
    'asmx',
    'ashx',
    'css',
    'cfm',
    'yaws',
    'swf',
    'html',
    'htm',
    'xhtml',
    'jhtml',
    'jsp',
    'jspx',
    'wss',
    'do',
    'action',
    'js',
    'pl',
    'php',
    'php5',
    'php4',
    'php3',
    'phtml',
    'py',
    'rb',
    'rhtml',
    'xml',
    'rss',
    'cgi',
    'dll'
]

let fileSort = {
    reverse: false,
    field: 'name'
}

let allFiles = []

let downloaded_urls = []

function textareaInputEvent(event) {
    if (event.keyCode === 13) {
        event.preventDefault()
        return false
    }

    if (this.value.match(newlineRegex)) {
        this.value = this.value.replace(newlineRegex, '')
    }

    allFiles[this.parentNode._index].name = this.value

    this.style.height = ' 0'
    this.style.height = this.scrollHeight + 'px'
}
function textareaBlurEvent() {
    this.value = this.value.trim()

    if (!this.value) {
        this.value = allFiles[this.parentNode._index]._originalName
    }

    allFiles[this.parentNode._index].name = this.value

    this.style.height = ' 0'
    this.style.height = this.scrollHeight + 'px'
}

function getFileExt(url) {
    url = url
        .split('/')
        .pop()
        .match(fileExtRegex)

    return url ? url[1].toLowerCase() : ''
}
function getFileDomain(url) {
    var domain = url.split('/')[url.indexOf('://') == -1 ? 0 : 2]
    return domain.split(':')[0]
}
function getFileName(url) {
    return url.split('/').pop()
}

function getFileEntryElement() {
    if (fileEntryElementPool.length > 0) {
        return fileEntryElementPool.pop()
    }

    let elem = document.createElement('li')

    elem.appendChild(document.createElement('button'))
    elem.lastChild.className = 'toggle-button'
    elem.lastChild.textContent = '✔'

    elem.appendChild(document.createElement('span'))
    elem.lastChild.className = 'domain'

    elem.appendChild(document.createElement('span'))
    elem.lastChild.className = 'url'

    elem.appendChild(document.createElement('textarea'))
    elem.lastChild.className = 'name'
    elem.lastChild.wrap = 'soft'
    elem.lastChild.cols = '1'
    elem.lastChild.rows = '1'
    elem.lastChild.spellcheck = false
    elem.lastChild.addEventListener('input', textareaInputEvent)
    elem.lastChild.addEventListener('change', textareaInputEvent)
    elem.lastChild.addEventListener('blur', textareaBlurEvent)

    elem.appendChild(document.createElement('span'))
    elem.lastChild.className = 'type'

    elem.appendChild(document.createElement('button'))
    elem.lastChild.className = 'download-button'
    elem.lastChild.textContent = '⬇'

    return elem
}

function listFile(file) {
    let entry = getFileEntryElement()

    if (file.enabled) {
        entry.className = ''
        entry.children[0].textContent = '✔'
    } else {
        entry.children[0].textContent = '✖'
        entry.className = 'disabled'
    }

    entry.children[1].textContent = file.domain
    entry.children[2].textContent = file.url
    entry.children[3].value = file.name || file.urlName
    entry.children[4].textContent = file.ext

    entry._index = allFiles.indexOf(file)

    elements.list.appendChild(entry)

    textareaBlurEvent.call(entry.children[3])
}

function filterFileResult(file) {
    if (!options.include_media && file.media) {
        return false
    }

    if (!options.include_website_links && webFileTypes.includes(file.ext)) {
        return false
    }

    if (
        options.filters.regex &&
        !file.url.toLowerCase().match(options.filters.regex)
    ) {
        return false
    }

    if (options.filters.ext) {
        let found = false

        for (let i = 0; i < options.filters.ext.length; i++) {
            if (file.ext.includes(options.filters.ext[i])) {
                found = true
                break
            }
        }

        if (!found) {
            return false
        }
    }
    if (options.filters.ext_exclude) {
        for (let i = 0; i < options.filters.ext_exclude.length; i++) {
            if (file.ext.includes(options.filters.ext_exclude[i])) {
                return false
            }
        }
    }

    let url = file.url.toLowerCase()
    let name = file.name.toLowerCase()

    if (options.filters.name) {
        let found = false

        for (let i = 0; i < options.filters.name.length; i++) {
            if (
                url.includes(options.filters.name[i]) ||
                name.includes(options.filters.name[i])
            ) {
                found = true
                break
            }
        }

        if (!found) {
            return false
        }
    }
    if (options.filters.name_exclude) {
        for (let i = 0; i < options.filters.name_exclude.length; i++) {
            if (
                url.includes(options.filters.name_exclude[i]) ||
                name.includes(options.filters.name_exclude[i])
            ) {
                return false
            }
        }
    }

    return true
}

function updateList() {
    if (sortFns[fileSort.field + (fileSort.reverse ? '_r' : '')]) {
        allFiles.sort(sortFns[fileSort.field + (fileSort.reverse ? '_r' : '')])
    }

    if (options.filter_regex) {
        try {
            options.filters.regex = new RegExp(options.filter_regex)
            elements.regex_message.textContent = ''
        } catch (error) {
            elements.regex_message.textContent = '' + error
            options.filters.regex = null
        }
    } else {
        options.filters.regex = null
        elements.regex_message.textContent = ''
    }

    if (options.filter_name) {
        options.filters.name = options.filter_name
            .toLowerCase()
            .split(',')
            .filter(name => name.trim().length > 0)
            .map(name => name.trim())
    } else {
        options.filters.name = null
    }
    if (options.filter_name_exclude) {
        options.filters.name_exclude = options.filter_name_exclude
            .toLowerCase()
            .split(',')
            .filter(name => name.trim().length > 0)
            .map(name => name.trim())
    } else {
        options.filters.name_exclude = null
    }

    if (options.filter_ext) {
        options.filters.ext = options.filter_ext
            .toLowerCase()
            .split(',')
            .filter(ext => ext.trim().length > 0)
            .map(ext => ext.trim())
    } else {
        options.filters.ext = null
    }
    if (options.filter_ext_exclude) {
        options.filters.ext_exclude = options.filter_ext_exclude
            .toLowerCase()
            .split(',')
            .filter(ext => ext.trim().length > 0)
            .map(ext => ext.trim())
    } else {
        options.filters.ext_exclude = null
    }

    while (elements.list.childElementCount > 0) {
        fileEntryElementPool.push(
            elements.list.removeChild(elements.list.lastElementChild)
        )
    }

    for (let i = 0; i < allFiles.length; i++) {
        if (filterFileResult(allFiles[i])) {
            allFiles[i].active = true

            listFile(allFiles[i])
        } else {
            allFiles[i].active = false
        }
    }
}

function downloadFile(file) {
    chrome.runtime.sendMessage({
        download: true,

        source: activeTabUrl,

        url: file.url,
        name: options.download_custom_name ? file.name : null,
        subdirectory: options.download_subdirectory,

        select_location: options.download_select_location,

        conflictAction: options.download_overwrite ? 'overwrite' : 'uniquify'
    })

    if (!downloaded_urls.includes(file.url)) {
        downloaded_urls.push(file.url)
    }
}

let lastSaveTime = 0
function updateFilterOptions(filters) {
    if (
        filters.regex &&
        document.querySelector('.regex').style.display === ''
    ) {
        document.getElementById('OPTION_filter_regex').value = filters.regex
        onOptionChange.call(
            document.getElementById('OPTION_filter_regex'),
            'filter_regex'
        )
    }

    if (filters.name) {
        document.getElementById('OPTION_filter_name').value = filters.name
        onOptionChange.call(
            document.getElementById('OPTION_filter_name'),
            'filter_name'
        )
    }
    if (filters.name_exclude) {
        document.getElementById('OPTION_filter_name_exclude').value =
            filters.name_exclude

        document.getElementById('OPTION_Exclude_by name').checked = true
        document.getElementById('OPTION_filter_name_exclude').style.display = ''

        onOptionChange.call(
            document.getElementById('OPTION_filter_name_exclude'),
            'filter_name_exclude'
        )
    }

    if (filters.ext) {
        document.getElementById('OPTION_filter_ext').value = filters.ext
        onOptionChange.call(
            document.getElementById('OPTION_filter_ext'),
            'filter_ext'
        )
    }
    if (filters.ext_exclude) {
        document.getElementById('OPTION_filter_ext_exclude').value =
            filters.ext_exclude

        document.getElementById('OPTION_Exclude_by type').checked = true
        document.getElementById('OPTION_filter_ext_exclude').style.display = ''

        onOptionChange.call(
            document.getElementById('OPTION_filter_ext_exclude'),
            'filter_ext_exclude'
        )
    }
}
function writeFilterStorage() {
    chrome.storage.local.get('site_filters', result => {
        let activeDomain = getFileDomain(activeTabUrl)

        let newSiteFilters = []

        if (result.site_filters && Array.isArray(result.site_filters)) {
            newSiteFilters = result.site_filters.filter(
                site => site.domain !== activeDomain
            )
        }

        while (newSiteFilters.length > 10) {
            newSiteFilters.shift()
        }

        newSiteFilters.push({
            domain: activeDomain,

            regex:
                document.querySelector('.regex').style.display === ''
                    ? options.filter_regex
                    : null,

            name: options.filter_name,
            name_exclude: options.filter_name_exclude,

            ext: options.filter_ext,
            ext_exclude: options.filter_ext_exclude
        })

        chrome.storage.local.set({
            site_filters: newSiteFilters
        })
    })
}
function saveFilterOptions() {
    setTimeout(() => {
        if (Date.now() - lastSaveTime > 900) {
            lastSaveTime = Date.now()
            writeFilterStorage()
        }
    }, 1000)
}

function scanPage() {
    chrome.tabs.executeScript(
        activeTabId,
        {
            file: 'page_script.js'
        },
        e => {
            if (e === undefined) {
                let message = '不能访问当前页面!'

                if (chrome.runtime.lastError) {
                    message += '\n\n' + chrome.runtime.lastError.message
                }

                elements.status.firstElementChild.textContent = message
                elements.status.style.display = ''
            } else {
                document.body.parentElement.style.width = '1000vw'
            }
        }
    )
}

//Interface setup
{
    function onBoolOptionChange(optionName) {
        options[optionName] = this.checked

        updateList()
    }
    function onOptionChange(optionName) {
        options[optionName] = this.value

        updateList()

        if (optionName.includes('filter')) {
            saveFilterOptions()
        }
    }

    function saveBoolOptionToStorage(optionName) {
        let obj = {}
        obj[optionName] = this.checked

        chrome.storage.sync.set(obj)
    }
    function saveOptionToStorage(optionName) {
        let obj = {}
        obj[optionName] = this.value

        chrome.storage.sync.set(obj)
    }

    function getOptionElem(
        optionName,
        optionType,
        optionLabel,
        interactCallback,
        useStorage
    ) {
        if (optionType === 'button') {
            let elem = document.createElement('button')
            elem.className = optionName

            elem.textContent = optionLabel

            elem.addEventListener('click', interactCallback)

            return elem
        }

        if (!optionName) {
            optionName = optionLabel.replace(/ /, '_')
        }

        let elem = document.createElement('div')

        if (optionLabel) {
            elem.appendChild(document.createElement('label'))
            elem.lastChild.textContent = optionLabel
            elem.lastChild.setAttribute('for', 'OPTION_' + optionName)
        }

        elem.appendChild(document.createElement('input'))
        elem.lastChild.type = optionType
        elem.lastChild.id = 'OPTION_' + optionName

        if (optionType === 'checkbox') {
            elem.insertBefore(elem.lastChild, elem.firstChild)

            elem.className = 'checkbox'

            if (typeof interactCallback === 'function') {
                elem.firstChild.addEventListener(
                    'change',
                    interactCallback.bind(elem.firstChild)
                )
            } else {
                elem.firstChild.addEventListener(
                    'change',
                    onBoolOptionChange.bind(elem.firstChild, optionName)
                )
            }

            if (useStorage) {
                chrome.storage.sync.get(optionName, result => {
                    elem.firstChild.checked = result[optionName]
                    onBoolOptionChange.call(elem.firstChild, optionName)
                })

                elem.firstChild.addEventListener(
                    'change',
                    saveBoolOptionToStorage.bind(elem.firstChild, optionName)
                )
            }
        } else {
            if (typeof interactCallback === 'function') {
                elem.lastChild.addEventListener(
                    'input',
                    interactCallback.bind(elem.lastChild)
                )
            } else {
                elem.lastChild.addEventListener(
                    'input',
                    onOptionChange.bind(elem.lastChild, optionName)
                )
            }

            if (useStorage) {
                chrome.storage.sync.get(optionName, result => {
                    if (result.hasOwnProperty(optionName)) {
                        elem.lastChild.value = result[optionName]
                        onOptionChange.call(elem.lastChild, optionName)
                    }
                })

                elem.lastChild.addEventListener(
                    'input',
                    saveOptionToStorage.bind(elem.lastChild, optionName)
                )
            }
        }

        return elem
    }

    elements.controls.appendChild(
        getOptionElem('include_media', 'checkbox', '可见文件', null, true)
    )
    elements.controls.appendChild(
        getOptionElem(
            'include_website_links',
            'checkbox',
            '网页连接',
            null,
            true
        )
    )
    elements.controls.appendChild(document.createElement('hr'))

    elements.controls.appendChild(
        getOptionElem('filter_regex', 'text', '过滤URL的正则')
    )
    elements.regex_message = document.createElement('label')
    elements.regex_message.className = 'message'
    elements.regex_message.id = 'regex_message'
    elements.controls.lastChild.appendChild(elements.regex_message)
    elements.controls.lastChild.className = 'regex'

    elements.controls.appendChild(document.createElement('hr'))

    elements.controls.appendChild(document.createElement('div'))
    elements.controls.lastChild.className = 'multi'
    elements.controls.lastChild.appendChild(
        getOptionElem('filter_name', 'text', '根据名称筛选')
    )
    elements.controls.lastChild.appendChild(
        getOptionElem('', 'checkbox', '根据名称排除', function (e) {
            let elem = document.getElementById('OPTION_filter_name_exclude')

            if (this.checked) {
                elem.style.display = ''

                options.filter_name_exclude = elem.value
            } else {
                elem.style.display = 'none'

                options.filter_name_exclude = ''
            }

            onOptionChange.call(
                {
                    value: options.filter_name_exclude
                },
                'filter_name_exclude'
            )
        })
    )
    elements.controls.lastChild.appendChild(
        getOptionElem('filter_name_exclude', 'text', '')
    )
    document.getElementById('OPTION_filter_name_exclude').style.display = 'none'

    elements.controls.appendChild(document.createElement('div'))
    elements.controls.lastChild.className = 'multi'
    elements.controls.lastChild.appendChild(
        getOptionElem('filter_ext', 'text', '根据类型筛选')
    )
    elements.controls.lastChild.appendChild(
        getOptionElem('', 'checkbox', '根据类型排除', function (e) {
            let elem = document.getElementById('OPTION_filter_ext_exclude')

            if (this.checked) {
                elem.style.display = ''

                options.filter_ext_exclude = elem.value
            } else {
                elem.style.display = 'none'

                options.filter_ext_exclude = ''
            }

            onOptionChange.call(
                {
                    value: options.filter_ext_exclude
                },
                'filter_ext_exclude'
            )
        })
    )
    elements.controls.lastChild.appendChild(
        getOptionElem('filter_ext_exclude', 'text', '')
    )
    document.getElementById('OPTION_filter_ext_exclude').style.display = 'none'

    elements.actions.appendChild(
        getOptionElem(
            'download_subdirectory',
            'text',
            'Sub-folder',
            function (event) {
                if (this.value.includes('.')) {
                    this.value = this.value.replace(dotRegex, '')
                }

                if (this.value.match(invalidPathRegex)) {
                    this.value = this.value.replace(invalidPathRegex, '')
                }

                options.download_subdirectory = this.value
            },
            true
        )
    )

    elements.actions.appendChild(
        getOptionElem(
            'download_overwrite',
            'checkbox',
            'Overwrite existing',
            null,
            true
        )
    )

    elements.actions.appendChild(
        getOptionElem(
            'download_custom_name',
            'checkbox',
            'Use custom name',
            null,
            true
        )
    )
    elements.actions.appendChild(
        getOptionElem(
            'download_select_location',
            'checkbox',
            '显示保存界面',
            null,
            true
        )
    )

    elements.actions.appendChild(document.createElement('hr'))

    //Disable all button
    elements.actions.appendChild(
        getOptionElem('highlight-negative', 'button', '✖', () => {
            for (let i = 0; i < allFiles.length; i++) {
                allFiles[i].enabled = false
            }
            for (let i = 0; i < list.childNodes.length; i++) {
                list.childNodes[i].className = 'disabled'
                list.childNodes[i].firstChild.textContent = '✖'
            }
        })
    )
    //Enable all button
    elements.actions.appendChild(
        getOptionElem('highlight', 'button', '✔', () => {
            for (let i = 0; i < allFiles.length; i++) {
                allFiles[i].enabled = true
            }
            for (let i = 0; i < list.childNodes.length; i++) {
                list.childNodes[i].className = ''
                list.childNodes[i].firstChild.textContent = '✔'
            }
        })
    )
    //Download all button
    elements.actions.appendChild(
        getOptionElem('highlight', 'button', '下载', () => {
            let duplicates = []

            for (let i = 0; i < allFiles.length; i++) {
                if (allFiles[i].active && allFiles[i].enabled) {
                    if (downloaded_urls.includes(allFiles[i].url)) {
                        duplicates.push(allFiles[i])
                    } else {
                        downloadFile(allFiles[i])
                    }
                }
            }

            if (duplicates.length > 0) {
                let message = ''

                if (duplicates.length === 1) {
                    message =
                        '1 of the enabled files has already been sent to the download queue! Do you want to download it again?'
                } else {
                    message =
                        duplicates.length.toString() +
                        ' of the enabled files have already been sent to the download queue! Do you want to download them again?'
                }

                if (confirm(message)) {
                    for (let i = 0; i < duplicates.length; i++) {
                        downloadFile(duplicates[i])
                    }
                }
            }
        })
    )

    elements.actions.appendChild(document.createElement('p'))

    elements.actions.appendChild(
        getOptionElem('', 'button', 'Rescan Page', () => {
            scanPage()
        })
    )

    elements.actions.appendChild(
        getOptionElem('use_link_text', 'checkbox', 'Scan link text', null, true)
    )

    elements.actions.appendChild(document.createElement('p'))

    //Open downloads page
    elements.actions.appendChild(
        getOptionElem('', 'button', '查看下载页面', () => {
            chrome.tabs.create({ url: 'chrome://downloads' })
        })
    )

    //Open extension options
    elements.actions.appendChild(
        getOptionElem('', 'button', '配置', () => {
            chrome.runtime.openOptionsPage()
        })
    )
}

//file sort setup
{
    const tabs = {
        domain: document.getElementById('tab_domain'),
        url: document.getElementById('tab_url'),
        name: document.getElementById('tab_name'),
        ext: document.getElementById('tab_ext')
    }

    function setSort(field, reverse) {
        fileSort.field = field
        fileSort.reverse = reverse

        for (let tabName in tabs) {
            if (tabs[tabName].classList.contains('sort')) {
                tabs[tabName].classList.remove('sort')
            }
            if (tabs[tabName].classList.contains('sort_r')) {
                tabs[tabName].classList.remove('sort_r')
            }

            if (tabName === field) {
                if (reverse) {
                    tabs[tabName].classList.add('sort_r')
                } else {
                    tabs[tabName].classList.add('sort')
                }
            }
        }

        updateList()
    }

    function onTabClick(tabName) {
        if (tabs[tabName].classList.contains('sort')) {
            setSort(tabName, true)
        } else {
            setSort(tabName, false)
        }
    }

    for (let tabName in tabs) {
        tabs[tabName].addEventListener('click', onTabClick.bind(null, tabName))
    }

    setSort('name', false)
}

//Help setup
{
    let helpButton = getOptionElem('', 'button', '帮助', () => {
        showHelp()
    })

    let help = [
        {
            element: helpButton,
            name: '帮助',
            content: `<i>批量文件下载器</i> 是一个简单快速的网页文件查找下载工具。
            当插件开启时，会自动扫描当前页签所有可下载资源并将其展示在文件列表中，并且可以根据名称和类型对文件进行过滤。
            但是当页面内容变更时，<i>批量文件下载器</i>无法扫描到新增的文件资源。

            您可以在任意时间点击<b>帮助</b>按钮获取帮助，也可以点击右上角<b>关闭</b>退出此界面。
            点击其他项目，获取更多帮助~
            
            本插件为开源项目(https://github.com/luckyzerg/Multi-file-downloader)
            基于<b>Multi-file-downloade</b>进行二次开发(https://github.com/brttd/Multi-file-downloader)
            `
        },
        {
            element: elements.controls,
            name: '过滤器',
            content: `The files found on a page can be filtered before being downloaded.
<b>Visible Media</b>: Include images and videos shown directly in pages (links to media files will be included regardless of this option).
<b>Web links</b>: Include links with extensions commonly used for websites (.html, .php, etc).

<b>Filter by name</b>: Only files where the URL or name matches will be listed.
<b>Filter by type</b>: Only files where the file type (extension) matches will be listed.

If multiple filters are needed, you can enter each one separated by a comma.

<b>Exclude by name/type</b>: Files which match the filter will be excluded from the list.`
        },
        {
            element: elements.list.parentNode,
            name: 'File List',
            content: `All files found on a page which match the filters are shown here.
The list can be sorted by <b>Domain</b>, <b>URL</b>, <b>Name</b>, and <b>Type</b>. Click on a column to sort it, or reverse the sort direction.
The <b>Name</b> column can be edited to give a custom filename used when the files are downloaded.

Each file can be enabled or disabled by clicking the toggle button in the leftmost column.
Each file can be downloaded on it's own by clicking the download button in the rightmost column.`
        },
        {
            element: elements.actions,
            name: 'Downloading',
            content: `<b>Sub-folder</b>: A sub-folder of Chrome's download folder, into which files will be downloaded.
Due to limitations with Chrome's download system, files can only be downloaded to Chrome's downloads folder, or a sub-folder within it.

<b>Overwrite existing</b>: If enabled, new downloads will overwrite any already existing file with the same name.
<b>Use custom name</b>: If enabled, downloads will the <b>Name</b> entry in the <i>File List</i>. Otherwise, the default name of the file will be used.
<b>Show save dialog</b>: If enabled, will show the Save As dialog for every download.

<b>✖</b>: Disable all files.
<b>✔</b>: Enable all files.
<b>Download</b>: Download all enabled files.`
        },
        {
            element: elements.actions,
            name: 'Options',
            content: `<b>Rescan Page</b>: Searches the active tab for links again. This will reset the <i>File List</i>!
<b>Scan link text</b>: Will take link text and use it as the file name.

<b>View Downloads</b>: Opens Chrome's downloads page.
<b>Open Options</b>: Opens the <i>Multi-File Downloader</i> extension options.
<b>Help</b>: Opens the help, which you're viewing now.`
        },
        {
            element: elements.download_status.parentNode,
            name: 'Downloads Status',
            content: `Displays how many files are currently being downloaded.

<b>Cancel From This Tab</b>: Cancels all currently in-progress downloads which were downloaded from the active tab (or from any other tab with the same URL).
<b>Cancel All</b>: Cancels all currently in-progress downloads.`
        }
    ]

    let activeIndex = -1

    let helpElem = document.createElement('div')
    helpElem.id = 'help'
    helpElem.style.display = 'none'

    let nameElem = document.createElement('h2')
    let textElem = document.createElement('div')
    textElem.id = 'content'

    function showHelp(index = 0) {
        if (index < 0 || index >= help.length) {
            index = 0
        }
        activeIndex = index

        let currentActive = document.querySelector('#help .active')
        if (currentActive) {
            currentActive.classList.remove('active')
        }
        helpElem.lastChild.children[index].classList.add('active')

        nameElem.textContent = help[index].name
        textElem.innerHTML = help[index].content

        let elem = document.querySelector('.help-highlight')
        if (elem) {
            elem.classList.remove('help-highlight')
        }

        elem = help[index].element

        elem.classList.add('help-highlight')

        let spaceAbove = elem.offsetTop
        let spaceBelow =
            window.innerHeight - (elem.offsetTop + elem.offsetHeight)

        if (spaceAbove > spaceBelow) {
            helpElem.style.bottom =
                (window.innerHeight - spaceAbove + 5).toString() + 'px'
            helpElem.style.top = '5px'

            helpElem.style.maxHeight = (spaceAbove - 5).toString() + 'px'
        } else {
            helpElem.style.top =
                (elem.offsetTop + elem.offsetHeight + 5).toString() + 'px'
            helpElem.style.bottom = '5px'

            helpElem.style.maxHeight = (spaceBelow - 5).toString() + 'px'
        }

        helpElem.style.display = ''
        elements.status.style.display = ''
        elements.status.firstChild.textContent = ''
    }

    elements.actions.appendChild(helpButton)

    helpElem.appendChild(document.createElement('div'))
    helpElem.lastChild.id = 'bar'
    helpElem.lastChild.appendChild(nameElem)
    helpElem.appendChild(textElem)

    helpElem.appendChild(document.createElement('ul'))

    helpElem.firstChild.appendChild(document.createElement('a'))
    helpElem.firstChild.lastChild.textContent = 'Close'
    helpElem.firstChild.lastChild.addEventListener('click', () => {
        helpElem.style.display = 'none'
        elements.status.style.display = 'none'

        let elem = document.querySelector('.help-highlight')
        if (elem) {
            elem.classList.remove('help-highlight')
        }

        activeIndex = -1
    })

    for (let i = 0; i < help.length; i++) {
        helpElem.lastChild.appendChild(document.createElement('a'))
        helpElem.lastChild.lastChild.textContent = help[i].name

        helpElem.lastChild.lastChild.addEventListener(
            'click',
            showHelp.bind(null, i)
        )
    }

    window.addEventListener('resize', () => {
        if (activeIndex !== -1) {
            showHelp(activeIndex)
        }
    })

    document.body.appendChild(helpElem)

    chrome.storage.local.get('help_shown_2-1', result => {
        if (!result['help_shown_2-1']) {
            showHelp()

            let obj = {}
            obj['help_shown_2-1'] = true

            chrome.storage.local.set(obj)
        }
    })
}

chrome.runtime.onMessage.addListener(message => {
    if (typeof message !== 'object') {
        return false
    }

    if (message.message) {
        elements.status.firstChild.textContent = message.message
        elements.status.style.display = ''

        return false
    }

    if (message.files) {
        if (message.url !== activeTabUrl) {
            return false
        }

        allFiles = []

        for (let i = 0; i < message.files.length; i++) {
            if (message.files[i].url) {
                message.files[i].active = false
                message.files[i].enabled = true
                message.files[i]._originalName = message.files[i].name

                message.files[i].domain = getFileDomain(message.files[i].url)
                message.files[i].urlName = getFileName(message.files[i].url)
                message.files[i].ext = getFileExt(message.files[i].url)

                allFiles.push(message.files[i])
            }
        }

        updateList()
    }

    if (typeof message.downloads === 'object') {
        console.log(message.downloads)

        if (message.downloads.active === 0) {
            elements.download_status.textContent = '没有下载中的文件'
            elements.download_status.parentNode.className = ''
        } else if (message.downloads.active === 1) {
            elements.download_status.textContent = '1个下载中'
            elements.download_status.parentNode.className = 'active'
        } else {
            elements.download_status.textContent =
                message.downloads.active.toString() + ' 下载中'

            elements.download_status.parentNode.className = 'active'
        }

        if (message.downloads.active > 0 || message.downloads.waiting > 0) {
            cancelActiveButton.disabled = false
            cancelAllButton.disabled = false
        } else {
            cancelActiveButton.disabled = true
            cancelAllButton.disabled = true
        }

        if (message.downloads.waiting >= 1) {
            elements.download_status.textContent +=
                ', ' + message.downloads.waiting.toString() + ' d.'
        } else {
            elements.download_status.textContent += '.'
        }
    }
})

elements.list.addEventListener('click', event => {
    if (event.target.tagName !== 'BUTTON') {
        return false
    }

    let index = event.target.parentNode._index

    if (index < 0 || index >= allFiles.length) {
        return false
    }

    if (event.target.className === 'toggle-button') {
        allFiles[index].enabled = !allFiles[index].enabled

        if (allFiles[index].enabled) {
            event.target.parentNode.className = ''
            event.target.textContent = '✔'
        } else {
            event.target.textContent = '✖'
            event.target.parentNode.className = 'disabled'
        }
    } else if (event.target.className === 'download-button') {
        if (downloaded_urls.includes(allFiles[index].url)) {
            if (
                confirm(
                    '当前文件已在下载队列中! 请问还要再次下载嘛?'
                )
            ) {
                downloadFile(allFiles[index])
            }
        } else {
            downloadFile(allFiles[index])
        }
    }
})

chrome.tabs.query(
    { active: true, lastFocusedWindow: true, currentWindow: true },
    tabs => {
        if (tabs.length > 0) {
            activeTabUrl = tabs[0].url
            activeTabId = tabs[0].id

            scanPage()

            chrome.storage.local.get('site_filters', result => {
                if (result.site_filters && Array.isArray(result.site_filters)) {
                    let activeDomain = getFileDomain(activeTabUrl)

                    let filters = result.site_filters.find(
                        site => site.domain === activeDomain
                    )

                    if (filters) {
                        updateFilterOptions(filters)
                    }
                }
            })
        } else {
            let message = '不允许访问当前页签!\n请重试.\n'

            if (chrome.runtime.lastError) {
                message += '\n\n' + chrome.runtime.lastError.message
            }

            elements.status.firstElementChild.textContent = message
            elements.status.style.display = ''
        }
    }
)

chrome.storage.sync.get('regex_enabled', result => {
    if (result.regex_enabled) {
        document.querySelector('.regex').style.display = ''
    } else {
        document.querySelector('.regex').style.display = 'none'
    }
})

chrome.extension.isAllowedFileSchemeAccess(allowed => {
    if (!allowed) {
        console.log('File URL access is not allowed')
    }
})

chrome.runtime.sendMessage('get-stats')

let cancelActiveButton = document.createElement('button')
cancelActiveButton.textContent = 'Cancel From This Tab'

let cancelAllButton = document.createElement('button')
cancelAllButton.textContent = 'Cancel All'

cancelActiveButton.addEventListener('click', () => {
    if (activeTabUrl) {
        chrome.runtime.sendMessage({
            cancel_downloads: true,
            url: activeTabUrl
        })
    }
})
cancelAllButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel all downloads?')) {
        chrome.runtime.sendMessage({
            cancel_downloads: true
        })
    }
})

elements.download_status.parentNode.appendChild(cancelActiveButton)
elements.download_status.parentNode.appendChild(cancelAllButton)
