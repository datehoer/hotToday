# 百度 https://top.baidu.com/board?tab=realtime
# 知乎 https://www.zhihu.com/hot
# 微博 https://weibo.com/ajax/side/hotSearch
# 36氪 https://www.36kr.com/newsflashes/catalog/1
# 少数派 https://sspai.com/
# 虎嗅网 https://www.huxiu.com/
# it之家 https://m.ithome.com/rankm/
# 哔哩哔哩 https://www.bilibili.com/v/popular/all/
# 抖音热点 https://www.douyin.com/
# AcFun https://www.acfun.cn/rank/list/?cid=-1&pcid=-1&range=DAY
# 吾爱破解人气热门 https://www.52pojie.cn/forum.php?mod=guide&view=hot
# 贴吧热议 https://tieba.baidu.com/hottopic/browse/topicList?res_type=1
# 腾讯新闻 https://new.qq.com/ch/qa
# 虎扑社区热帖 https://bbs.hupu.com/
# 雪球 https://xueqiu.com/today
# 第一财经 https://www.yicai.com/api/ajax/getranklistbykeys?keys=newsRank%2CvideoRank%2CimageRank%2CliveRank
# 新浪新闻 https://www.sina.com.cn/
# 新浪新闻排行榜 https://finance.sina.com.cn/topnews
# 水木社区本日十大话题 https://www.newsmth.net/nForum/#!mainpage
# 开眼 https://m.eyepetizer.net/
# 宽带山人气排行榜24小时 https://club.kdslife.com/f_15.html
# 豆瓣电影一周口碑榜、北美票房榜 https://movie.douban.com/chart
# 微信读书榜单 https://weread.qq.com/web/category/rising
# 起点榜单 https://www.qidian.com/rank/
# 纵横中文网榜单 https://www.zongheng.com/rank?nav=default
# taptap榜单 https://www.taptap.cn/top/download
# 3dm游戏排行榜 https://www.3dmgame.com/phb.html
# 新浪体育热门 https://sports.sina.com.cn/
# 人人都是产品经理 https://www.woshipm.com/
# PMCAFF精选 https://coffee.pmcaff.com/?type=2
# GitHub今天最兴奋的 https://github.com/trending
# CSDN排行榜 https://blog.csdn.net/rank/list
# 掘金排行榜 https://juejin.cn/hot/articles
# 站酷榜单 https://www.zcool.com.cn/top/index.do#tab_anchor
# 优设读报 https://www.uisdc.com/news
# 汽车之家论坛热帖榜 https://club.autohome.com.cn/
# 懂车帝文章排行榜、视频排行榜 https://www.dongchedi.com/
# 懂车帝热搜榜 https://www.dongchedi.com/news/dynamic_motor_car
# 易车资讯排行榜、视频排行榜 https://www.yiche.com/
# 太平洋汽车文章排行榜、帖子排行榜 https://www.pcauto.com.cn/
# 看雪精华主题 https://bbs.kanxue.com/
# freebuf资讯 https://www.freebuf.com/news
# 安全客头条资讯 https://www.anquanke.com/
# 电商报7*24快讯 https://www.dsb.cn/news
# 游戏葡萄文章 https://youxiputao.com/article.html
# 白鲸出海7*24 https://www.baijing.cn/newsflashes_txzq/
# 谷歌实时搜索趋势 https://trends.google.com/trends/api/realtimetrends?hl=zh-CN&tz=-480&cat=all&fi=0&fs=0&geo=US&ri=300&rs=20&sort=0
# steam热销 https://store.steampowered.com/charts/
# epic热销 https://store.epicgames.com/en-US/collection/top-sellers
# openai论坛今日热榜 https://community.openai.com/top?period=daily
# v2ex最热 https://www.v2ex.com/?tab=hot
# 纽约时报中文一周热点 https://cn.nytimes.com/async/mostviewed/all/?lang=zh-hans
# 力扣每日必读 https://leetcode.cn/graphql/ {"operationName":"trendingContents","variables":{"skip":0,"limit":10,"subListSlug":"ri"},"query":"query trendingContents($limit: Int!, $skip: Int!, $subListSlug: String!) {\n  trendingContents(limit: $limit, skip: $skip, subListSlug: $subListSlug) {\n    ... on TrendingQuestionNode {\n      companyTags {\n        slug\n        imgUrl\n        __typename\n      }\n      companyTagCount\n      otherTags {\n        name\n        nameTranslated\n        slug\n        __typename\n      }\n      otherTagCount\n      difficulty\n      translatedTitle\n      title\n      titleSlug\n      __typename\n    }\n    ... on TrendingQAOrArticleNode {\n      author {\n        name\n        userSlug\n        avatar\n        __typename\n      }\n      uuid\n      summary\n      title\n      createdAt\n      articleType\n      __typename\n    }\n    ... on TrendingSolutionNode {\n      videoCoverUrl\n      author {\n        name\n        userSlug\n        __typename\n      }\n      questionSlug\n      questionTitle\n      translatedQuestionTitle\n      title\n      slug\n      createdAt\n      __typename\n    }\n    ... on TrendingTagNode {\n      name\n      nameTranslated\n      slug\n      tagType\n      __typename\n    }\n    __typename\n  }\n}\n"}
# qq阅读榜单 https://book.qq.com/book-rank
# 网易云榜单 https://music.163.com/#/discover/toplist
# 酷我音乐榜单 https://www.kuwo.cn/rankList
# qq音乐榜单 https://y.qq.com/n/ryqq/toplist/4
# 酷安今日热门
# 头条热榜 https://www.toutiao.com/
# 网易新闻 https://c.m.163.com/
# 风闻24小时最热 https://user.guancha.cn/?s=fwdhfw
# 东方财富导读 https://finance.eastmoney.com/a/ccjdd.html
# 蓝点网最新发布 https://www.landiannews.com/
# 游民星空 https://www.gamersky.com/
# 豆瓣24小时话题榜 https://www.douban.com/gallery/
# oschina热门资讯 https://www.oschina.net/news
# zol48小时最热 https://news.zol.com.cn/
# 知无不言热门 https://www.wearesellers.com/
# spotify 排行榜 https://open.spotify.com/genre/0JQ5DAB3zgCauRwnvdEQjJ
# 飘云阁人气热门 https://www.chinapyg.com/
# 澎湃新闻热榜 https://www.thepaper.cn/
# 新华网新华时政 http://www.news.cn/politics/szlb/index.html
# 华为新闻 https://www.huawei.com/cn/news
# 脉脉热榜
