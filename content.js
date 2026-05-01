// content.js

// 创建侧边栏容器
function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'detail-sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-container">
            <div class="sidebar-header">
                <h3>项目详情</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="sidebar-content">
                <div class="loading">正在加载详情...</div>
            </div>
        </div>
    `;
    document.body.appendChild(sidebar);
    
    // 关闭按钮事件
    sidebar.querySelector('.close-btn').addEventListener('click', () => {
        sidebar.classList.remove('open');
    });
    
    return sidebar;
}

// 获取或创建侧边栏
let sidebar = null;

// 根据XPath查找元素
function getElementsByXPath(xpath) {
    const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
    );
    const elements = [];
    for (let i = 0; i < result.snapshotLength; i++) {
        elements.push(result.snapshotItem(i));
    }
    return elements;
}

// 使用MutationObserver监听DOM变化
function observeAndIntercept() {
    // 修改XPath：去掉序号，匹配所有li下的a标签
    const targetXPath = '/html/body/div[3]/div[3]/ul/li/div/div[2]/div/div/a';
    
    // 初始检查
    const elements = getElementsByXPath(targetXPath);
    
    if (elements.length > 0) {
        interceptLinks(elements);
    }
    
    // 监听DOM变化
    const observer = new MutationObserver((mutations) => {
        const elements = getElementsByXPath(targetXPath);
        if (elements.length > 0) {
            interceptLinks(elements);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// 拦截链接点击
function interceptLinks(links) {
    links.forEach((link, index) => {
        // 避免重复绑定
        if (link.dataset.intercepted === 'true') {
            return;
        }
        
        link.dataset.intercepted = 'true';
        
        // 移除原有的onclick属性
        const onclickAttr = link.getAttribute('onclick');
        if (onclickAttr) {
            link.removeAttribute('onclick');
        }
        
        // 添加点击事件监听器（捕获阶段，优先级最高）
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // 初始化侧边栏
            if (!sidebar) {
                sidebar = createSidebar();
            }
            
            const contentArea = sidebar.querySelector('.sidebar-content');
            
            // 如果侧边栏已打开，直接更新内容（不需要关闭再打开的动画）
            const isOpen = sidebar.classList.contains('open');
            contentArea.innerHTML = '<div class="loading">正在加载详情...</div>';
            
            if (!isOpen) {
                sidebar.classList.add('open');
            }
            
            // 获取详情页URL
            let detailUrl = link.href || link.getAttribute('href');
            
            // 如果没有href，尝试从onclick获取
            if (!detailUrl || detailUrl === '#' || detailUrl === 'javascript:;') {
                const onclickStr = onclickAttr || '';
                const urlMatch = onclickStr.match(/['"]([^'"]+)['"]/);
                if (urlMatch) {
                    detailUrl = urlMatch[1];
                }
            }
            
            if (detailUrl && detailUrl !== '#' && detailUrl !== 'javascript:;') {
                loadDetail(detailUrl, contentArea);
            } else {
                contentArea.innerHTML = '<div class="error">无法获取详情链接</div>';
            }
        }, true); // 使用捕获阶段
    });
}

// 加载详情页内容
async function loadDetail(url, contentArea) {
    try {
        // 处理相对路径
        const absoluteUrl = url.startsWith('http') ? url : window.location.origin + url;
        
        const response = await fetch(absoluteUrl);
        if (!response.ok) throw new Error('网络请求失败');
        const htmlText = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        // 尝试多个可能的内容选择器
        const selectors = ['.cot_info', '.detail-content', '.content', 'main', '#content'];
        let targetContent = null;
        
        for (const selector of selectors) {
            targetContent = doc.querySelector(selector);
            if (targetContent) {
                break;
            }
        }
        
        if (targetContent) {
            // 移除按钮组
            const btnGroup = targetContent.querySelector('.btn_group.btn_group_2');
            if (btnGroup) {
                btnGroup.remove();
            }
            contentArea.innerHTML = targetContent.innerHTML;
        } else {
            contentArea.innerHTML = '<div class="error">未找到详情内容</div>';
        }
        
    } catch (error) {
        contentArea.innerHTML = '<div class="error">加载失败，请检查网络或登录状态</div>';
    }
}

// 启动拦截
observeAndIntercept();