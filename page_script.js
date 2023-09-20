window._injected_downloader = window._injected_downloader || false

if (window._injected_downloader) {
    console.info('Downloader page_script.js has already been injected')

    chrome.storage.sync.get('use_link_text', result => {
        if (typeof result.use_link_text === 'boolean') {
            if (
                result.use_link_text !==
                window._downloader_options.use_link_text
            ) {
                window._downloader_options.use_link_text = result.use_link_text
            }
        }

        window._downloader_find_files_function()
    })
} else {
    window._injected_downloader = true

    window._downloader_options = {
        use_link_text: false
    }


    function getFileContent(text) {
        text = text.toLowerCase();
        return text.endsWith(".xls") || text.endsWith(".xlsx") || text.endsWith(".doc")
    }

    let fileExtRegex = new RegExp(/\.([0-9a-z]+)(?:[\?#]|$)/i)

    function getFileExt(url) {
        const ext = url
            .split('/')
            .pop()
            .match(fileExtRegex)
        return ext ? url : false
    }

    function parseOpenFileUrl(link) {
        let url = link.href;
        url = url.replace(/javascript:openFile|\(|'/g, '');
        return url.split(',')[0];
    }

    function clearUrl(link) {
        let finalUrl = getFileExt(link.href);
        if (finalUrl) {
            return finalUrl
        }
        if (link.href.indexOf('javascript:openFile') > -1) {
            return parseOpenFileUrl(link);
        }

        if (link.hasAttribute('download')) {
            return link.href;
        }

        let nameExt = getFileContent(link.textContent)
        if (nameExt) {
            return link.href
        }

        return false;

    }


    function getSelector(e) {
        let domPath = Array();
        //判断是否存在ID
        if (e.id) {
            domPath.unshift('#' + e.id.toLocaleLowerCase());
        } else {
            //循环匹配元素
            while (e.nodeName.toLowerCase() !== "html") {
                if (e.id) {
                    //判断是否存在ID
                    domPath.unshift('#' + e.id.toLocaleLowerCase());
                    break;
                } else if (e.tagName.toLocaleLowerCase() === "body") {
                    //判断是否是BODY元素
                    domPath.unshift(e.tagName.toLocaleLowerCase());
                } else {
                    //遍历获取元素顺序
                    for (i = 0; i < e.parentNode.childElementCount; i++) {
                        if (e.parentNode.children[i] === e) {
                            domPath.unshift(e.tagName.toLocaleLowerCase() + ':nth-child(' + (i + 1) + ')');
                        }
                    }
                }
                e = e.parentNode;
            }
            return domPath.toString().replaceAll(',', '>');
        }

    }

    function findFiles() {
        let files = []

        let urls = []

        let links = document.getElementsByTagName('a')
        let images = document.getElementsByTagName('img')
        let videos = document.getElementsByTagName('video')
        let pictures = document.getElementsByTagName('picture')

        for (let i = 0; i < links.length; i++) {
            if (links[i].href.startsWith('mailto:' || urls.includes(links[i].href))) {
                continue
            }
            const validUrl = clearUrl(links[i])
            if (validUrl) {
                urls.push(links[i].href)
                files.push({
                    name:
                        links[i].getAttribute('download') ||
                        links[i].href.split('/').pop(),
                    link_text: links[i].textContent.replace('\n', ''),
                    url: validUrl,
                    image: false,
                    open: links[i].href.indexOf('javascript:openFile') > -1,
                    click: links[i].hasAttribute('wm_ev_click'),
                    selector: getSelector(links[i])
                })
            }

        }

        for (let i = 0; i < images.length; i++) {
            if (!urls.includes(images[i].currentSrc)) {
                urls.push(images[i].currentSrc)

                files.push({
                    name: images[i].currentSrc.split('/').pop(),
                    url: images[i].currentSrc,
                    media: true
                })
            }
        }

        for (let i = 0; i < videos.length; i++) {
            if (!urls.includes(videos[i].src)) {
                urls.push(videos[i].src)

                files.push({
                    name: videos[i].src.split('/').pop(),
                    url: videos[i].src,
                    media: true
                })
            }
        }

        for (let i = 0; i < pictures.length; i++) {
            let img = pictures.getElementsByTagName('img').pop()

            if (img && !urls.includes(img.currentSrc)) {
                urls.push(img.currentSrc)

                files.push({
                    name: img.currentSrc.split('/').pop(),

                    url: img.currentSrc,

                    media: true
                })
            }
        }

        if (window._downloader_options.use_link_text) {
            for (let i = 0; i < files.length; i++) {
                if (files[i].link_text) {
                    if (!getFileExt(files[i].link_text)) {
                        files[i].name =
                            files[i].link_text + '.' + getFileExt(files[i].name)
                    } else {
                        files[i].name = files[i].link_text
                    }
                }
            }
        }

        chrome.runtime.sendMessage({
            url: window.location.href,

            files: files
        })
    }

    window._downloader_find_files_function = findFiles

    findFiles()

    chrome.storage.sync.get('use_link_text', result => {
        if (typeof result.use_link_text === 'boolean') {
            if (
                result.use_link_text !==
                window._downloader_options.use_link_text
            ) {
                window._downloader_options.use_link_text = result.use_link_text

                window._downloader_find_files_function()
            }
        }
    })
}
