# Local publishers and communities

**English** · [简体中文](local-sources.zh-CN.md)

This expansion adds 23 independent sources from Canada, Germany, South Korea,
Australia and New Zealand. Every source uses the local site's own feed or page,
keeps its original headline and article/discussion link, and runs hourly. English,
French, German and Korean titles remain in their original language.

## Canada

| Key            | Publisher / entry                                                            | Selection                 | Heat         |
| -------------- | ---------------------------------------------------------------------------- | ------------------------- | ------------ |
| `cbc`          | [CBC Canada RSS](https://www.cbc.ca/webfeed/rss/rss-canada)                  | Latest Canadian news      | Not supplied |
| `globalnews`   | [Global News RSS](https://globalnews.ca/feed/)                               | Latest news               | Not supplied |
| `ctv`          | [CTV News RSS](https://www.ctvnews.ca/arc/outboundfeeds/rss/?outputType=xml) | Latest news               | Not supplied |
| `nationalpost` | [National Post RSS](https://nationalpost.com/feed/)                          | Latest news               | Not supplied |
| `radiocanada`  | [Radio-Canada RSS](https://ici.radio-canada.ca/info/rss/info/a-la-une)       | French-language headlines | Not supplied |

## Germany

| Key            | Publisher / entry                                                         | Selection                | Heat             |
| -------------- | ------------------------------------------------------------------------- | ------------------------ | ---------------- |
| `spiegel`      | [SPIEGEL Topnews RSS](https://www.spiegel.de/schlagzeilen/tops/index.rss) | Editorial top stories    | Not supplied     |
| `zeit`         | [ZEIT RSS](https://newsfeed.zeit.de/index)                                | Latest news              | Not supplied     |
| `heise`        | [heise Atom](https://www.heise.de/rss/heise-atom.xml)                     | Latest technology news   | Not supplied     |
| `sueddeutsche` | [Süddeutsche Topthemen RSS](https://rss.sueddeutsche.de/rss/Topthemen)    | Editorial top stories    | Not supplied     |
| `mydealz`      | [mydealz](https://www.mydealz.de/)                                        | Community deal selection | Site temperature |

## South Korea

| Key          | Publisher / entry                                                           | Selection                       | Heat         |
| ------------ | --------------------------------------------------------------------------- | ------------------------------- | ------------ |
| `naver_news` | [Naver rankings](https://news.naver.com/main/ranking/popularDay.naver)      | Each publisher's most-read list | Not supplied |
| `newsis`     | [NEWSIS](https://www.newsis.com/realnews/)                                  | Most-read sidebar               | Not supplied |
| `bizwatch`   | [Business Watch](https://news.bizwatch.co.kr/popular)                       | Most-read business news         | Not supplied |
| `dcinside`   | [DC Inside realtime best](https://gall.dcinside.com/board/lists/?id=dcbest) | Community best board            | Views        |
| `nate_pann`  | [Nate Pann](https://pann.nate.com/talk/ranking)                             | Realtime community ranking      | Views        |

Naver does not provide an overall national rank here. Its publisher lists are
interleaved: each publisher's first article precedes their second. Up to 100
unique articles are retained. Numbered list positions are never stored as views.

## Australia

| Key         | Publisher / entry                          | Selection                  | Heat                    |
| ----------- | ------------------------------------------ | -------------------------- | ----------------------- |
| `abc_au`    | [ABC News](https://www.abc.net.au/news/)   | Editorial top stories      | Not supplied            |
| `sbs_au`    | [SBS News](https://www.sbs.com.au/news)    | Homepage headlines         | Not supplied            |
| `ozbargain` | [OzBargain](https://www.ozbargain.com.au/) | Community front-page deals | Upvotes minus downvotes |

## New Zealand

| Key        | Publisher / entry                                                                            | Selection                  | Heat                    |
| ---------- | -------------------------------------------------------------------------------------------- | -------------------------- | ----------------------- |
| `stuff`    | [Stuff Atom](https://www.stuff.co.nz/rss)                                                    | Latest news                | Not supplied            |
| `nzherald` | [NZ Herald RSS](https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/nz/?outputType=xml) | Latest New Zealand news    | Not supplied            |
| `tvnz`     | [TVNZ 1News](https://www.1news.co.nz/)                                                       | Homepage headlines         | Not supplied            |
| `cheapies` | [ChoiceCheapies](https://www.cheapies.nz/)                                                   | Community front-page deals | Upvotes minus downvotes |
| `geekzone` | [Geekzone](https://www.geekzone.co.nz/)                                                      | Most recent discussions    | Not supplied            |

## Collection and validation

News and discussion sources retain at most 20–30 entries each, except Naver's
broader publisher coverage. Missing popularity measurements use `hotScore: 0`,
the existing crawler convention; this is not a measured score. Source names
distinguish news, editorial headlines, most-read lists and community selections.
Scores have different units across sites and should not be compared directly.

The plugins use the existing Python dependencies. Each custom parser is entirely
inside its own source directory so repair sandboxes can copy and test it alone.
Atom handling and feeds whose publisher/article hosts differ are implemented in
those plugins. Extraction is explicit, with generic fallback disabled, and a
changed or blocked page raises an error instead of producing an empty success.
No account, personal cookies or API keys are embedded in these sources.

Run the offline checks and a read-only live fetch from the repository root:

```bash
python -m unittest discover -s tests -v
python task.py --check
python task.py --only cbc spiegel naver_news abc_au stuff
```

`--only` fetches without writing snapshots, invoking embeddings or requesting AI
repairs. The first ordinary collection round creates the new source tables, and
incremental ETL discovers them automatically.

## Frontend rollout

The separate `hot-rank-web` API reads its visible source cards from Redis
`card_table`. New crawler directories do not register cards in that runtime
catalog. [local-source-cards.json](local-source-cards.json) contains the 23 new
`{name, tablename}` entries in that API's format. Merge them by `tablename` into
the existing list, keeping its other cards and order, once the first source
snapshots exist. Invalidate the API's `rank` cache after updating the catalog.
`parse_common` already accepts these plugins' stored list of
`{title, url, hotScore}` objects; no new ranking parser is required.

The companion API registers these sources and their agent query labels in
`hot-rank-web/hotrank/source_catalog.py`. In that API's runtime, preview and apply
the idempotent catalog merge:

```bash
docker exec hotrank python -m hotrank.source_catalog
docker exec hotrank python -m hotrank.source_catalog --apply
```

The command preserves existing cards and order, extends an explicit agent
allowlist with the new sources, and invalidates `rank` in one watched Redis
transaction. It saves the previous registries under the reported backup key for
seven days. An absent agent allowlist continues to use the application defaults.
Restart the API after deploying its updated Python source registry.

## Entries still requiring a working public route

On 25 October 2026 the collection host received access-denied/challenge responses
from RedFlagDeals, theqoo and Whirlpool, and a denied La Presse RSS request.
They are not enabled plugins. A working public route still needs to be verified
before adding them; other publishers' stories are not substituted under their
names.
