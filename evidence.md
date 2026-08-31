# Evidence pack — slide 14 ("Only the data that queries touch is ever transcoded")

Research: Codex deep-research (3 rounds, adversarially red-teamed) + independent verification of every
load-bearing quote against the primary source (PDF or live page). Compiled 2026-08-31.

## What the slide claims, and what backs it

Slide claim: the lake is *written once, read rarely*; eager whole-lake ETL/transcoding wastes work,
so LiquidCache transcodes lazily, on miss.

Defensible chain (all modern-stack sources, 2018–2026):

1. **Warehouses spend most compute writing and transforming, not serving reads.**
   - Snowflake (Snowset, ~70M queries, 14 days): ~28% read-only / ~13% write-only / **~59% read-write**
     queries, which the authors classify as ETL-style pipelines ("Many queries have read-write ratio
     close to 1, in terms of number of bytes, that represent Extract Transform Load (ETL) pipelines").
     — Vuppalapati et al., NSDI 2020, Fig. 2. https://www.usenix.org/conference/nsdi20/presentation/vuppalapati
   - Same trace, reanalyzed: read-write queries are 57.6% of queries and **71.6% of CPU**; ~61.2% of them
     have read_bytes/write_bytes within 1±0.1; "In total, ≈70% of queries perform updates."
     — van Renen & Leis, "Cloud Analytics Benchmark", PVLDB 16(6), 2023, §2.2/Table 1.
     https://doi.org/10.14778/3583140.3583156
   - Redshift fleet: read-only SELECT is 48.9% of statements but only **28.6% of runtime**;
     COPY (38.3%) + CTAS (16.4%) = **54.7% of fleet runtime**. — van Renen et al., "Why TPC Is Not
     Enough: An Analysis of the Amazon Redshift Fleet", PVLDB 17(11), 2024, Table 2.
     https://doi.org/10.14778/3681954.3682031

2. **Once written, data goes cold fast or feeds a single consumer.**
   - **Azure fleet telemetry (slide, line 1):** "over 50% of smart-tier–managed capacity has
     automatically shifted to cooler tiers" — i.e. ≥30 consecutive days with neither a read nor a
     write (both restart the clock; cool after 30 days, cold after another 60). Covers Blob + ADLS;
     a large analytics customer (hundreds of TiB of telemetry/logs) also saw >half move cooler.
     — Aung Oo (VP Azure Storage), Azure Blog, 2026-04-14.
     https://azure.microsoft.com/en-us/blog/optimize-object-storage-costs-automatically-with-smart-tier-now-generally-available/
   - **Redshift CTAS (slide, line 2):** "around ≈80% of CTAS tables are only used by one query each"
     (§3.3) — ETL outputs typically materialized for exactly one downstream read before recreation.
     CTAS tables as a class still matter (~40% of queries touch one). — PVLDB 17(11), 2024.
   - Netflix media ingest (~2 PB/week into S3): "internal research shows that at least 40% of data
     never gets used"; lifecycle "upload -> read -> reupload -> no-reads"; storage bill historically
     +50%/yr. — "Navigating the Netflix Data Deluge", Netflix Tech Blog, 2024-03-26.
     https://netflixtechblog.com/navigating-the-netflix-data-deluge-the-imperative-of-effective-data-management-e39af70f81f7
   - Netflix S3 warehouse: 180-day read/write lookback TTL recommendations + cost dashboards
     "contributed to over a 10% decrease in our data warehouse storage footprint".
     — "Byte Down", Netflix Tech Blog, 2020-07-08.
     https://netflixtechblog.com/byte-down-making-netflixs-data-infrastructure-cost-effective-fee7b3235032
   - IBM Cloud Object Storage production trace T15: **48% of objects accessed exactly once**
     (Table 2; ignore the transposed "98%" in §6.1.2 prose — table + evaluation text agree on 48%).
     — Liu et al., "SkyStore", PVLDB 18(7), 2025. https://doi.org/10.14778/3734839.3734846
   - Redshift fleet: only **10% of columns** were ever used as predicate/join/group/sort/distribution
     columns (§5.1, Table 7). Caveat: excludes projection-only reads — use as physical-design skew, not
     "90% of columns never read".

3. **Corroboration (vendor-grade, cite verbally only):**
   - AWS: "customers have saved more than $6 billion in storage costs" with S3 Intelligent-Tiering
     (cumulative since 2018). https://aws.amazon.com/s3/storage-classes/intelligent-tiering/
   - Snowflake ships detectors for "tables over 100 GB where data is written but never read"
     (Optimization Insights docs) — the pattern is operationally material, no prevalence published.
   - Select Star / AlphaSense case study: "6,000+ Unused Tables Deprecated", 43% table-count reduction
     in one BigQuery estate (vendor case study, methodology undisclosed).
   - Jordan Tigani (BigQuery founding engineer), "Big Data is Dead": "90% of queries processed less
     than 100 MB of data"; "The most recent month might have 5% of data but 80% of data accesses."
     Practitioner essay — graphs hand-drawn from memory, not fleet telemetry.
     https://motherduck.com/blog/big-data-is-dead/

## Q&A defense sheet (if a reviewer attacks a number)

| Stat on/behind slide | What it actually measures | Honest one-liner under attack |
|---|---|---|
| Azure >50% / ≥30 days | Opt-in smart-tier-managed Blob+ADLS capacity, byte-weighted; "cooler" = cool+cold; sub-128KiB objects excluded | "Not an all-Azure estimate — in opted-in deployments, over half of managed capacity saw neither a read nor a write for 30+ days." |
| Redshift ~80% CTAS single-use | Table count (not bytes); one downstream query before recreation | "The claim is one consumer before recreation — not 'read once forever', not '80% of Redshift bytes are cold'." |
| Snowset 59% RW / 71.6% CPU | Query counts / CPU from a 2018 two-week trace | "It supports the ingest/transform-heavy half of the argument, not the read-rarely half." |
| Redshift 54.7% runtime on COPY+CTAS | Runtime, not CPU/cost/bytes | "Narrow claim: COPY+CTAS runtime exceeds SELECT's 28.6% in this fleet." |
| Netflix ≥40% never used | Studios media-production ingest, not a SQL warehouse; window/method unpublished | "First-party media-ingest result — that's why it stays in the notes with the qualifier, not on the slide." |
| Netflix >10% footprint cut | Joint effect of dashboards + 180-day TTL recommendations | "Evidence that usage-aware retention removes material storage — not a measured never-read rate." |
| SkyStore 48% one-hit | One selected IBM COS trace, object-count, week-long | "Table 2 and the evaluation agree on 48% for T15; I don't generalize it." |

## Do NOT claim

- "Most lakehouse bytes are never read" — no public study establishes this for modern stacks.
- ">50% of all Azure/cloud data is never read" — Azure's denominator is opt-in managed capacity, ≥30-day inactivity.
- "80% of Redshift tables are read once" — it's CTAS-created tables, one query *before recreation*.
- "Only 10% of columns are read" — predicate-column stat excludes projections.
- Netflix's 40% generalized beyond Studios media ingest.
- Any eager-vs-lazy transcoding benchmark conclusion from these sources — that step is our design
  inference (and our cold-run results carry it).

## Known negative results (don't re-chase)

- No peer-reviewed study joins ETL cost and later zero-read status at object level for Parquet/Iceberg/Delta/Hudi.
- Redset (public Redshift sample) cannot give never-read table fractions (no catalog of untouched tables).
- Tectonic (FAST'21), Dremel decade (VLDB'20), Presto@Meta (SIGMOD'23), Redshift Re-invented (SIGMOD'22),
  Warfield's S3 FAST'23 keynote: no usable fleet cold/unread fractions.
- BigQuery/Databricks: no public fleet read-mix or cold-fraction telemetry found.
- Historical only (user ruled HDFS-era stale for this talk): Yahoo HDFS 2010-2012 studies measured
  42–46% of retained bytes with zero opens in 6 months (Abad et al., IISWC'12) and ~60% of bytes
  untouched over 20 days (GreenHDFS, HotPower'10) — consistent with, but not cited for, the modern claim.
