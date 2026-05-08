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

// 添加"查询已选人数"按钮（只在收藏页面显示）
addCourseDetailsButton();

// 添加"中签概率排序"按钮（只在项目查询页面显示）
addProbabilitySortButton();

// 监听已申请项目并添加信息
observeAppliedProjects();

function getDemandCountFromItem(item) {
    const renshuEl = item.querySelector('.zhiwei .renshu') || item.querySelector('.renshu');
    if (!renshuEl) return 0;

    const demandMatch = renshuEl.textContent.match(/需求人数[:：]\s*(\d+)/);
    return demandMatch ? parseInt(demandMatch[1], 10) : 0;
}

function parseApplyCountsFromText(text) {
    const labels = ['第一志愿', '第二志愿', '第三志愿', '第四志愿'];
    return labels.map(label => {
        const match = text.match(new RegExp(`${label}\\s*[:：]\\s*(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
    });
}

function buildApplyCountsHtml(counts) {
    const zhiyuanLabels = ['第一志愿', '第二志愿', '第三志愿', '第四志愿'];
    let countHtml = '<span style="color: #8B5CF6;">已申请人数（';

    zhiyuanLabels.forEach((label, idx) => {
        const count = counts[idx] || 0;
        if (idx === 0) {
            countHtml += `<i>${label}：<strong>${count}</strong></i>`;
        } else {
            countHtml += ` <i>${label}：${count}</i>`;
        }
    });

    countHtml += '）</span>';
    return countHtml;
}

async function fetchApplyCounts(projectId) {
    if (!projectId) return null;

    try {
        const apiUrl = `${window.location.origin}/b/xs/xmsq/queryApplyCounts/${projectId}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) return null;

        const data = await response.json();
        if (data.result !== 'success' || !data.object) return null;

        const counts = [0, 0, 0, 0];
        data.object.forEach(c => {
            const index = parseInt(c.ZYXH, 10) - 1;
            if (index >= 0 && index < counts.length) {
                counts[index] = parseInt(c.COUNT, 10) || 0;
            }
        });

        return counts;
    } catch (error) {
        return null;
    }
}

async function getApplyCountsForItem(item) {
    const span = item.querySelector('.renshu > span[id]');
    if (!span) return [0, 0, 0, 0];

    const hasContent = span.innerHTML.trim().length > 0;
    if (hasContent) {
        return parseApplyCountsFromText(span.textContent);
    }

    span.dataset.loading = 'true';
    const counts = await fetchApplyCounts(span.id);
    span.dataset.loading = 'false';

    if (counts) {
        span.innerHTML = buildApplyCountsHtml(counts);
        return counts;
    }

    return [0, 0, 0, 0];
}

function calculateProbabilityScores(demandCount, counts) {
    const scores = [];

    for (let index = 0; index < 4; index++) {
        const higherPreferenceCount = counts.slice(0, index).reduce((sum, count) => sum + count, 0);
        const remainingQuota = demandCount - higherPreferenceCount;
        const currentPreferencePool = (counts[index] || 0) + 1;

        if (remainingQuota <= 0 || currentPreferencePool <= 0) {
            scores.push(0);
        } else {
            scores.push(Math.min(1, remainingQuota / currentPreferencePool));
        }
    }

    return scores;
}

async function sortAllDataByProbability(button) {
    const itemsContainer = document.querySelector('#allData > div.items');
    if (!itemsContainer) return;

    const items = Array.from(itemsContainer.children).filter(child => child.tagName === 'DIV');
    if (items.length === 0) return;

    const sortableItems = [];

    for (const item of items) {
        const demandCount = getDemandCountFromItem(item);
        const counts = await getApplyCountsForItem(item);
        const scores = calculateProbabilityScores(demandCount, counts);

        item.dataset.firstChoiceProbability = String(scores[0]);
        item.dataset.secondChoiceProbability = String(scores[1]);

        sortableItems.push({
            item,
            firstChoiceProbability: scores[0],
            secondChoiceProbability: scores[1],
            originalIndex: sortableItems.length
        });
    }

    sortableItems.sort((a, b) => {
        if (b.firstChoiceProbability !== a.firstChoiceProbability) {
            return b.firstChoiceProbability - a.firstChoiceProbability;
        }

        if (b.secondChoiceProbability !== a.secondChoiceProbability) {
            return b.secondChoiceProbability - a.secondChoiceProbability;
        }

        return a.originalIndex - b.originalIndex;
    });

    const fragment = document.createDocumentFragment();
    sortableItems.forEach(({ item }) => fragment.appendChild(item));
    itemsContainer.appendChild(fragment);

    if (button) {
        button.title = '已按第一志愿概率、第二志愿概率从高到低排序';
    }
}

function addProbabilitySortButton() {
    function checkAndAddButton() {
        const allTab = document.querySelector('.tabs_tit.all');
        const isAllSelected = allTab && allTab.classList.contains('tabs_select');
        const allTiaoshu = document.querySelector('#allData > div.tiaoshu');

        if (isAllSelected && allTiaoshu) {
            if (allTiaoshu.querySelector('.probability-sort-btn')) return;

            const btn = document.createElement('a');
            btn.className = 'probability-sort-btn';
            btn.textContent = '中签概率排序';

            btn.addEventListener('click', async (e) => {
                e.preventDefault();

                if (btn.dataset.loading === 'true') return;

                btn.dataset.loading = 'true';
                btn.textContent = '排序中...';
                btn.style.opacity = '0.6';

                await sortAllDataByProbability(btn);

                btn.textContent = '中签概率排序';
                btn.style.opacity = '1';
                btn.dataset.loading = 'false';
            });

            allTiaoshu.appendChild(btn);
        } else {
            document.querySelectorAll('.probability-sort-btn').forEach(btn => btn.remove());
        }
    }

    const observer = new MutationObserver(() => {
        checkAndAddButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tabs_tit')) {
            setTimeout(() => checkAndAddButton(), 100);
        }
    });

    setTimeout(() => checkAndAddButton(), 500);
}

function addCourseDetailsButton() {
    // 检查是否在收藏页面（tabs_tit collect 有 tabs_select 类）
    function checkAndAddButton() {
        const collectTab = document.querySelector('.tabs_tit.collect');
        const isCollectSelected = collectTab && collectTab.classList.contains('tabs_select');
        
        // 找到收藏页面的 tiaoshu div（collectData）
        const collectTiaoshu = document.querySelector('#collectData > div.tiaoshu');
        
        if (isCollectSelected && collectTiaoshu) {
            // 在收藏页面，显示按钮
            if (collectTiaoshu.dataset.buttonAdded !== 'true') {
                // 创建紫色按钮
                const btn = document.createElement('a');
                btn.className = 'course-details-btn';
                btn.textContent = '查询已选人数';
                btn.style.marginLeft = '15px';
                btn.style.cursor = 'pointer';
                btn.style.backgroundColor = '#8B5CF6';
                btn.style.color = '#fff';
                btn.style.padding = '6px 12px';
                btn.style.borderRadius = '4px';
                btn.style.display = 'inline-block';
                btn.style.fontSize = '14px';
                btn.style.textDecoration = 'none';
                
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    btn.textContent = '加载中...';
                    btn.style.opacity = '0.6';
                    
                    await fillMissingApplyCounts();
                    
                    setTimeout(() => {
                        btn.textContent = '查询已选人数';
                        btn.style.opacity = '1';
                    }, 500);
                });
                
                collectTiaoshu.appendChild(btn);
                collectTiaoshu.dataset.buttonAdded = 'true';
            }
        } else {
            // 不在收藏页面，移除按钮（如果存在）
            const allTiaoshu = document.querySelectorAll('.tiaoshu');
            allTiaoshu.forEach(tiaoshu => {
                const existingBtn = tiaoshu.querySelector('.course-details-btn');
                if (existingBtn) {
                    existingBtn.remove();
                }
                tiaoshu.dataset.buttonAdded = 'false';
            });
        }
    }
    
    // 监听DOM变化
    const observer = new MutationObserver(() => {
        checkAndAddButton();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // 监听标签点击
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tabs_tit')) {
            setTimeout(() => checkAndAddButton(), 100);
        }
    });
    
    // 初始检查
    setTimeout(() => checkAndAddButton(), 500);
}

// 补充缺失的申请人数信息
async function fillMissingApplyCounts() {
    // 找到所有 .renshu 下的 span 元素
    const renshuSpans = document.querySelectorAll('.renshu > span');
    
    renshuSpans.forEach(async (span) => {
        // 检查 span 是否为空（没有内容或只有空白）
        const hasContent = span.innerHTML.trim().length > 0;
        
        if (hasContent) {
            return; // 已有内容，跳过
        }
        
        // 避免重复处理
        if (span.dataset.loading === 'true') {
            return;
        }
        span.dataset.loading = 'true';
        
        // span 的 id 就是项目 ID
        const projectId = span.id;
        if (!projectId) return;
        
        // 调用 API 获取申请人数
        try {
            const apiUrl = `${window.location.origin}/b/xs/xmsq/queryApplyCounts/${projectId}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.result !== 'success' || !data.object) return;
            
            // 构建申请人数统计（全部紫色）
            const counts = data.object;
            let countHtml = '<span style="color: #8B5CF6;">已申请人数（';
            
            // 按志愿排序（ZYXH: 1,2,3,4）
            const zhiyuanMap = {};
            counts.forEach(c => {
                zhiyuanMap[c.ZYXH] = c.COUNT;
            });
            
            // 显示各志愿人数
            const zhiyuanLabels = ['第一志愿', '第二志愿', '第三志愿', '第四志愿'];
            zhiyuanLabels.forEach((label, idx) => {
                const count = zhiyuanMap[idx + 1] || 0;
                if (idx === 0) {
                    countHtml += `<i>${label}：<strong>${count}</strong></i>`;
                } else {
                    countHtml += ` <i>${label}：${count}</i>`;
                }
            });
            
            countHtml += '）</span>';
            
            // 更新 span 内容
            span.innerHTML = countHtml;
            
        } catch (error) {
            // 静默失败
        }
    });
}

// 为已申请项目添加需求人数、已选人数和点击事件
function observeAppliedProjects() {
    async function checkAndFillAppliedProjects() {
        const appliedList = document.querySelector('#applyData > div.lists.box_lists');
        if (!appliedList) return;
        
        const items = appliedList.querySelectorAll('.item.box_item');
        
        for (const item of items) {
            if (item.dataset.filled === 'true') continue;
            
            const cancelBtn = item.querySelector('.cancelApply');
            if (!cancelBtn) continue;
            
            const projectId = cancelBtn.getAttribute('xmid');
            if (!projectId) continue;
            
            const titEl = item.querySelector('.tit');
            if (!titEl) continue;
            
            // 1. 为标题添加点击劫持逻辑
            if (titEl.dataset.intercepted !== 'true') {
                titEl.dataset.intercepted = 'true';
                titEl.style.cursor = 'pointer';
                
                titEl.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    if (!sidebar) {
                        sidebar = createSidebar();
                    }
                    
                    const contentArea = sidebar.querySelector('.sidebar-content');
                    const isOpen = sidebar.classList.contains('open');
                    contentArea.innerHTML = '<div class="loading">正在加载详情...</div>';
                    
                    if (!isOpen) {
                        sidebar.classList.add('open');
                    }
                    
                    // 直接用 projectId 构建详情 URL
                    const detailUrl = `/f/xs/xmsq/view/${projectId}`;
                    loadDetail(detailUrl, contentArea);
                }, true);
            }
            
            // 2. 检查 allData 是否已加载
            const allDataItems = document.querySelectorAll('#allData .items .item');
            if (allDataItems.length === 0) {
                // allData 未加载，等待下次检查（不标记为已处理）
                continue;
            }
            
            // 标记为已处理（只有 allData 加载后才标记）
            item.dataset.filled = 'true';
            
            // 3. 从 #allData 中解析需求人数
            let demandCount = '-';
            for (const allItem of allDataItems) {
                const renshuSpan = allItem.querySelector(`.renshu > span[id="${projectId}"]`);
                if (renshuSpan) {
                    const renshuEl = allItem.querySelector('.zhiwei .renshu');
                    if (renshuEl) {
                        const fullText = renshuEl.textContent;
                        const demandMatch = fullText.match(/需求人数[:：](\d+)/);
                        if (demandMatch) {
                            demandCount = demandMatch[1];
                        }
                        break;
                    }
                }
            }
            
            // 4. 调用API获取各志愿人数
            try {
                const apiUrl = `${window.location.origin}/b/xs/xmsq/queryApplyCounts/${projectId}`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                
                if (!response.ok) continue;
                
                const data = await response.json();
                if (data.result !== 'success' || !data.object) continue;
                
                const zhiyuanMap = {};
                data.object.forEach(c => {
                    zhiyuanMap[c.ZYXH] = c.COUNT;
                });
                
                const z1 = zhiyuanMap[1] || 0;
                const z2 = zhiyuanMap[2] || 0;
                const z3 = zhiyuanMap[3] || 0;
                const z4 = zhiyuanMap[4] || 0;
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'renshu apply-project-renshu';
                infoDiv.style.cssText = 'font-size: 12px; color: #666;';
                infoDiv.innerHTML = `<span style="color: #8B5CF6;">人数状态：</span>${demandCount}:${z1}/${z2}/${z3}/${z4}`;
                titEl.after(infoDiv);
                
            } catch (error) {
                // 静默失败
            }
        }
    }
    
    const observer = new MutationObserver(() => {
        checkAndFillAppliedProjects();
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    setTimeout(() => checkAndFillAppliedProjects(), 1000);
    setTimeout(() => checkAndFillAppliedProjects(), 2000);
    setTimeout(() => checkAndFillAppliedProjects(), 3000);
    setTimeout(() => checkAndFillAppliedProjects(), 5000);
}
