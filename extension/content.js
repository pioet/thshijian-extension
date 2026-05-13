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
    // 修改XPath：去掉序号，匹配所有li下的a标签；同时覆盖已申请项目列表的标题链接
    const targetXPaths = [
        '/html/body/div[3]/div[3]/ul/li/div/div[2]/div/div/a',
        '/html[1]/body[1]/div[3]/div[2]/div[2]/div/div[3]//div[contains(concat(" ", normalize-space(@class), " "), " tit ")]/a'
    ];

    function getTargetLinks() {
        const links = [];

        targetXPaths.forEach((xpath) => {
            links.push(...getElementsByXPath(xpath));
        });

        return Array.from(new Set(links));
    }
    
    // 初始检查
    const elements = getTargetLinks();
    
    if (elements.length > 0) {
        interceptLinks(elements);
    }
    
    // 监听DOM变化
    const observer = new MutationObserver((mutations) => {
        const elements = getTargetLinks();
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
        const selectors = ['#applyForm']; // add project name in detail page
        // const selectors = ['.cot_info', '.detail-content', '.content', 'main', '#content'];
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

// 添加提交历史缓存和展示
cacheSubmittedApplyHistory();
addSubmitHistoryButton();

// 监听已申请项目并添加需求人数
observeAppliedProjects();

const SUBMIT_HISTORY_STORAGE_KEY = 'thshijianSubmitHistory';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function getSubmitHistory() {
    try {
        const rawHistory = localStorage.getItem(SUBMIT_HISTORY_STORAGE_KEY);
        const history = rawHistory ? JSON.parse(rawHistory) : [];
        return Array.isArray(history) ? history : [];
    } catch (error) {
        return [];
    }
}

function saveSubmitHistory(history) {
    localStorage.setItem(SUBMIT_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function getCurrentApplyProjectId() {
    const match = window.location.pathname.match(/\/f\/xs\/xmsq\/apply\/([^/?#]+)/);
    return match ? match[1] : '';
}

function cacheCurrentApplyForm() {
    const projectId = getCurrentApplyProjectId();
    const titleEl = document.querySelector('#applyForm > div.cot > div.title');
    const reasonEl = document.querySelector('#applyForm > div.cot_info > div.my_shenqing > div.panel-body > div:nth-child(1) > div > span > textarea');

    if (!projectId || !titleEl || !reasonEl) return;

    const projectName = titleEl.textContent.trim();
    const reason = reasonEl.value.trim();
    const submittedAt = new Date().toISOString();
    const history = getSubmitHistory();
    const record = {
        id: `${projectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectId,
        projectName,
        reason,
        submittedAt
    };

    history.unshift(record);
    saveSubmitHistory(history);
}

function cacheSubmittedApplyHistory() {
    if (!getCurrentApplyProjectId()) return;

    document.addEventListener('click', (e) => {
        const submitButton = e.target.closest('#applyForm > div.cot_info > div.btn_group.btn_group_2 > a.btn_sub.btn_orange_b.apply');
        if (!submitButton) return;

        cacheCurrentApplyForm();
    }, true);
}

function formatSubmitTime(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createSubmitHistoryModal() {
    let modal = document.querySelector('#submit-history-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'submit-history-modal';
    modal.innerHTML = `
        <div class="submit-history-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-history-title">
            <div class="submit-history-header">
                <h3 id="submit-history-title">提交历史</h3>
                <button class="submit-history-close" type="button" aria-label="关闭">&times;</button>
            </div>
            <div class="submit-history-content"></div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.submit-history-delete');
        if (deleteButton) {
            const historyId = deleteButton.dataset.historyId;
            deleteSubmitHistoryItem(historyId);
            return;
        }

        if (e.target.closest('.submit-history-close')) {
            closeSubmitHistoryModal();
        }
    });

    document.body.appendChild(modal);
    return modal;
}

function closeSubmitHistoryModal() {
    const modal = document.querySelector('#submit-history-modal');
    if (modal) {
        modal.classList.remove('open');
    }

    document.body.classList.remove('submit-history-modal-open');
}

function deleteSubmitHistoryItem(historyId) {
    if (!historyId) return;

    const history = getSubmitHistory();
    const nextHistory = history.filter(item => getSubmitHistoryItemId(item) !== historyId);

    saveSubmitHistory(nextHistory);

    const modal = document.querySelector('#submit-history-modal');
    const content = modal ? modal.querySelector('.submit-history-content') : null;
    if (content) {
        content.innerHTML = renderSubmitHistory();
    }
}

function getSubmitHistoryItemId(item) {
    if (item.id) return item.id;
    return `${item.projectId || ''}-${item.submittedAt || ''}`;
}

function renderSubmitHistory() {
    const history = getSubmitHistory();

    if (history.length === 0) {
        return '<div class="submit-history-empty">暂无提交历史</div>';
    }

    return history.map(item => `
        <div class="submit-history-item" data-history-id="${escapeHtml(getSubmitHistoryItemId(item))}">
            <div class="submit-history-item-head">
                <div class="submit-history-item-title">${escapeHtml(item.projectName || '未命名项目')}</div>
                <button class="submit-history-delete" type="button" data-history-id="${escapeHtml(getSubmitHistoryItemId(item))}">删除</button>
            </div>
            <div class="submit-history-meta">项目 ID：${escapeHtml(item.projectId || '')}</div>
            ${item.submittedAt ? `<div class="submit-history-meta">提交时间：${escapeHtml(formatSubmitTime(item.submittedAt))}</div>` : ''}
            <div class="submit-history-reason-label">申请理由</div>
            <div class="submit-history-reason">${escapeHtml(item.reason || '未填写')}</div>
        </div>
    `).join('');
}

function showSubmitHistoryModal() {
    const modal = createSubmitHistoryModal();
    const content = modal.querySelector('.submit-history-content');

    content.innerHTML = renderSubmitHistory();
    modal.classList.add('open');
    document.body.classList.add('submit-history-modal-open');
}

function addSubmitHistoryButton() {
    function checkAndAddButton() {
        const actionBar = document.querySelector('#applyData > div.acti.color_orange');
        if (!actionBar || actionBar.querySelector('.submit-history-btn')) return;

        const btn = document.createElement('a');
        btn.className = 'submit-history-btn';
        btn.textContent = '提交历史';
        btn.href = 'javascript:;';

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            showSubmitHistoryModal();
        });

        actionBar.appendChild(btn);
    }

    const observer = new MutationObserver(() => {
        checkAndAddButton();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    setTimeout(() => checkAndAddButton(), 500);
}

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

function normalizeProjectId(projectId) {
    return (projectId || '').replace(/^(all|collect)/, '');
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

function getProjectIdFromAppliedItem(item) {
    const idCarrier = item.querySelector('.cancelApply[xmid], [xmid]');
    const xmid = idCarrier ? idCarrier.getAttribute('xmid') : '';
    if (xmid) return normalizeProjectId(xmid);

    const countSpan = item.querySelector('.renshu > span[id]');
    if (countSpan && countSpan.id) return normalizeProjectId(countSpan.id);

    const link = item.querySelector('a[href*="/view/"], a[href*="/apply/"], .tit[href]');
    const linkText = link ? `${link.getAttribute('href') || ''} ${link.getAttribute('onclick') || ''}` : '';
    const match = linkText.match(/\/(?:view|apply)\/([^/?#'"]+)/);
    return match ? normalizeProjectId(match[1]) : '';
}

function getAppliedProjectDemandCount(projectId) {
    const normalizedProjectId = normalizeProjectId(projectId);
    const allDataItems = document.querySelectorAll('#allData > .items > div, #allData .items .item');

    for (const allItem of allDataItems) {
        const renshuSpan = Array.from(allItem.querySelectorAll('.renshu > span')).find((span) => {
            const mid = normalizeProjectId(span.getAttribute('mid'));
            const id = normalizeProjectId(span.id);
            return mid === normalizedProjectId || id === normalizedProjectId;
        });
        if (!renshuSpan) continue;

        const demandCount = getDemandCountFromItem(allItem);
        if (demandCount > 0) return String(demandCount);
    }

    return '-';
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
        const projectId = span.id.replace(/^collect/, '');
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

// 为已申请项目添加需求人数
function observeAppliedProjects() {
    function checkAndFillAppliedProjects() {
        const appliedList = document.querySelector('#applyData > div.lists.box_lists');
        if (!appliedList) return;
        
        const items = appliedList.querySelectorAll('.item.box_item');
        
        for (const item of items) {
            const projectId = getProjectIdFromAppliedItem(item);
            if (!projectId) continue;

            const demandCount = getAppliedProjectDemandCount(projectId);
            const existingInfoDiv = item.querySelector('.apply-project-demand-count');

            if (existingInfoDiv) {
                if (existingInfoDiv.dataset.demandCount !== demandCount) {
                    existingInfoDiv.dataset.demandCount = demandCount;
                    existingInfoDiv.innerHTML = `<span style="color: #8B5CF6;">需求人数：</span>${demandCount}`;
                }
                continue;
            }

            const insertBeforeEl = item.querySelector(':scope > div:nth-child(2)');
            if (!insertBeforeEl) continue;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'renshu apply-project-demand-count';
            infoDiv.dataset.demandCount = demandCount;
            infoDiv.style.cssText = 'font-size: 12px; color: #666;';
            infoDiv.innerHTML = `<span style="color: #8B5CF6;">需求人数：</span>${demandCount}`;
            item.insertBefore(infoDiv, insertBeforeEl);
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
