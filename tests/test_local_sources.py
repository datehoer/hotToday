"""Offline parser and crawler/ETL contract checks for the local-site expansion.

Run: python -m unittest discover -s tests -v
All headlines and metadata below are fictional. No database, credentials or
network access is needed, including when config.py does not exist.
"""
import html as html_escape
import importlib.util
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
KEYS = (
    "cbc globalnews ctv nationalpost radiocanada spiegel zeit heise sueddeutsche "
    "mydealz naver_news newsis bizwatch dcinside nate_pann abc_au sbs_au "
    "ozbargain stuff nzherald tvnz cheapies geekzone"
).split()


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


with patch.dict(sys.modules, {"config": SimpleNamespace(PROXIES={})}):
    PLUGINS = load_module("local_sources_plugins", ROOT / "plugins.py")
MODULES = {
    key: load_module("local_source_" + key, ROOT / "sources" / key / "spider.py")
    for key in KEYS if (ROOT / "sources" / key / "spider.py").exists()
}


def rss(host):
    return f"""<rss><channel>
    <item><title> News &amp; science </title><link>https://{host}/story</link></item>
    <item><title>Duplicate</title><link>https://{host}/story</link></item>
    <item><title>External</title><link>https://other.example/story</link></item>
    </channel></rss>""".encode()


def atom(host):
    return f"""<feed xmlns="http://www.w3.org/2005/Atom">
    <entry><title>Wissen &amp; Kultur</title>
      <link rel="self" href="https://{host}/metadata"/>
      <link href="https://{host}/story"/></entry>
    <entry><title>Duplicate</title><link href="https://{host}/story"/></entry>
    <entry><title>External</title><link href="https://other.example/story"/></entry>
    </feed>""".encode()


class FeedTests(unittest.TestCase):
    def test_publisher_feed_hosts_can_differ_from_article_hosts(self):
        for key, host in [("zeit", "www.zeit.de"), ("sueddeutsche", "www.sueddeutsche.de")]:
            with self.subTest(key=key):
                self.assertEqual(MODULES[key].parse_feed(rss(host)), [
                    {"title": "News & science", "url": f"https://{host}/story", "hotScore": 0},
                ])

    def test_atom_uses_article_link_and_not_self_link(self):
        for key, host in [("heise", "www.heise.de"), ("stuff", "www.stuff.co.nz")]:
            with self.subTest(key=key):
                self.assertEqual(MODULES[key].parse_feed(atom(host)), [
                    {"title": "Wissen & Kultur", "url": f"https://{host}/story", "hotScore": 0},
                ])

    def test_new_rss_manifests_survive_crawler_unwrapping(self):
        for key in KEYS:
            spec = PLUGINS._load(ROOT / "sources" / key, False)
            if spec["fetch"]["type"] != "rss":
                continue
            with self.subTest(key=key):
                from urllib.parse import urlsplit
                host = urlsplit(spec["fetch"]["url"]).hostname
                with patch.object(PLUGINS, "urlopen", return_value=io.BytesIO(rss(host))):
                    fetched = PLUGINS.fetch(spec)
                # task.crawl unwraps `data` before storing the snapshot.
                stored = fetched["data"]
                self.assertEqual(PLUGINS.extract_with(spec["extract"], stored), [
                    ("News & science", f"https://{host}/story", "0"),
                ])


class RankingTests(unittest.TestCase):
    def test_naver_interleaves_publishers_without_inventing_a_national_rank(self):
        text = """<div class="rankingnews_box"><ul class="rankingnews_list">
        <li><a class="list_title" href="https://n.news.naver.com/article/001/1?ntype=RANKING">한국 뉴스</a></li>
        <li><a class="list_title" href="https://n.news.naver.com/article/001/2">Another story</a></li>
        </ul></div><div class="rankingnews_box"><ul class="rankingnews_list">
        <li><a class="list_title" href="https://n.news.naver.com/article/002/1">Second publisher</a></li>
        </ul></div>"""
        rows = MODULES["naver_news"].parse_page(text)
        self.assertEqual([r["title"] for r in rows], ["한국 뉴스", "Second publisher", "Another story"])
        self.assertEqual(rows[0]["url"], "https://n.news.naver.com/article/001/1")
        self.assertEqual([r["hotScore"] for r in rows], [0, 0, 0])
        response = SimpleNamespace(content=text.encode("euc-kr"), encoding="euc-kr", raise_for_status=lambda: None)
        with patch.object(MODULES["naver_news"].requests, "get", return_value=response):
            self.assertEqual(MODULES["naver_news"].get_data(), rows)

    def test_newsis_removes_rank_digits_and_ignores_thumbnail_and_latest_list(self):
        rows = MODULES["newsis"].parse_page("""
        <a href="/view/latest">Latest story</a>
        <div class="rankBox"><div class="thumCont"><a href="/view/NIS1"><img/></a></div>
        <div class="txtCont"><a href="/view/NIS1"><p><strong class="rank">1</strong>한국 뉴스</p></a></div>
        </div>""")
        self.assertEqual(rows, [{"title": "한국 뉴스", "url": "https://www.newsis.com/view/NIS1", "hotScore": 0}])

    def test_bizwatch_extracts_headlines_without_summaries(self):
        rows = MODULES["bizwatch"].parse_page("""<div class="news_list"><dl>
        <dt><a href="//news.bizwatch.co.kr/article/finance/1">금융 뉴스</a></dt>
        <dd><a href="//news.bizwatch.co.kr/article/finance/1">Long summary</a></dd>
        </dl></div>""")
        self.assertEqual([r["title"] for r in rows], ["금융 뉴스"])

    def test_dcinside_skips_pinned_notices_and_reply_links(self):
        rows = MODULES["dcinside"].parse_page("""<table class="gall_list"><tbody>
        <tr><td class="gall_num">공지</td><td class="gall_tit"><a href="/board/view/?id=dcbest&amp;no=1">Rules</a></td></tr>
        <tr><td class="gall_num">234</td><td class="gall_tit">
          <a href="/board/view/?id=dcbest&amp;no=234&amp;page=3">Community story</a>
          <a class="reply_numbox" href="/board/view/?id=dcbest&amp;no=234">[10]</a></td>
          <td class="gall_count">12,345</td></tr>
        </tbody></table>""")
        self.assertEqual(rows, [{"title": "Community story", "url": "https://gall.dcinside.com/board/view/?id=dcbest&no=234", "hotScore": 12345}])

    def test_nate_pann_preserves_views_and_omits_comments_and_summary(self):
        rows = MODULES["nate_pann"].parse_page("""<div class="cntList"><ul class="post_wrap"><li><dl>
        <dt><h2><a href="/talk/123456">한국 이야기</a></h2><span class="reple-num">(100)</span></dt>
        <dd class="txt"><a href="/talk/123456">Summary</a></dd>
        <dd class="info"><span class="count">조회 48,519</span><span class="rcm">추천 224</span></dd>
        </dl></li></ul></div>""")
        self.assertEqual(rows, [{"title": "한국 이야기", "url": "https://pann.nate.com/talk/123456", "hotScore": 48519}])

    def test_deal_sites_keep_discussion_link_and_net_votes(self):
        for key, host in [("ozbargain", "www.ozbargain.com.au"), ("cheapies", "www.cheapies.nz")]:
            with self.subTest(key=key):
                rows = MODULES[key].parse_page("""<div class="node-ozbdeal">
                <a href="/goto/123">Merchant</a><h2 class="title"><a href="/node/123">A &amp; B <em>$10</em></a></h2>
                <span class="voteup"><i>+</i><span>1,234</span></span>
                <span class="votedown"><i>-</i><span>5</span></span></div>""")
                self.assertEqual(rows, [{"title": "A & B $10", "url": f"https://{host}/node/123", "hotScore": 1229}])

    def test_mydealz_uses_numeric_temperature_and_original_deal_link(self):
        meta = html_escape.escape(json.dumps({"props": {"thread": {"temperature": 75.14}}}), quote=True)
        text = f"""<article class="thread"><strong class="thread-title">
        <a class="js-thread-title" href="https://www.mydealz.de/deals/test-123">Angebot für Bücher</a>
        </strong><div data-vue3="{meta}"></div></article>"""
        rows = MODULES["mydealz"].parse_page(text)
        self.assertEqual(rows[0]["hotScore"], 75.14)
        self.assertEqual(rows[0]["title"], "Angebot für Bücher")
        with self.assertRaisesRegex(ValueError, "numeric temperature"):
            MODULES["mydealz"].parse_page(text.replace("75.14", "null"))


class HeadlineTests(unittest.TestCase):
    def test_homepages_exclude_navigation_and_duplicate_cards(self):
        samples = {
            "abc_au": ('<div class="TopStoriesCardList_grid__example"><a class="FullBleedLink_root__example" href="/news/2026-10-25/story/123">Headline</a></div>', "https://www.abc.net.au/news/2026-10-25/story/123"),
            "sbs_au": ('<main><a class="Card-module__example__cardTitleLink" href="/news/article/story/123">Headline</a></main>', "https://www.sbs.com.au/news/article/story/123"),
            "tvnz": ('<a href="/2026/10/25/story/"><h3 class="storyHeadline">Headline</h3></a>', "https://www.1news.co.nz/2026/10/25/story/"),
            "geekzone": ('<div class="boxGreen"><a href="forums.asp?forumid=48&amp;topicid=123">Headline</a><a href="forums.asp?forumid=48&amp;topicid=123&amp;page_no=2">2</a></div>', "https://www.geekzone.co.nz/forums.asp?forumid=48&topicid=123"),
        }
        for key, (text, url) in samples.items():
            with self.subTest(key=key):
                rows = MODULES[key].parse_page('<a href="/">Home</a>' + text + text)
                self.assertEqual(rows, [{"title": "Headline", "url": url, "hotScore": 0}])

    def test_challenge_or_changed_pages_fail_instead_of_reporting_success(self):
        for key, module in MODULES.items():
            with self.subTest(key=key):
                parse = getattr(module, "parse_feed", None) or module.parse_page
                with self.assertRaises(ValueError):
                    parse("<html><body>Temporarily unavailable</body></html>")

    def test_all_manifests_import_and_preserve_heat_after_snapshot_storage(self):
        for key in KEYS:
            with self.subTest(key=key):
                spec = PLUGINS._load(ROOT / "sources" / key, True)
                self.assertTrue(spec["enabled"])
                self.assertEqual(PLUGINS.missing(spec), [])
                self.assertFalse(spec["extract"]["generic_fallback"])
                self.assertEqual(PLUGINS.extract_with(spec["extract"], [
                    {"title": "Example headline", "url": "https://example.com/story", "hotScore": 42},
                ]), [("Example headline", "https://example.com/story", "42")])


if __name__ == "__main__":
    unittest.main()
