# Philippians Greek New Testament Study

Status: V1 implementation
Started: August 27, 2026

## Product intent

Philippians lives inside the same listener-first devotional library as Genesis, but it has its own Greek New Testament study lane rather than storing Greek material inside the legacy Hebrew tables.

The first published study is Philippians 1:1.

## Scripture contract

- English teaching text: King James Version.
- Greek base text: SBL Greek New Testament (SBLGNT), CC BY 4.0.
- The app must distinguish the Greek text itself from lexical explanation, interpretation, theology, and personal application.
- Meaningful SBLGNT / Textus Receptus differences may be noted when relevant to the KJV, but they must not be exaggerated into doctrinal drama.
- Historical or lexical uncertainty must remain explicit.

## Greek sermon engine

The protected endpoint is `/api/generate-next-philippians-verse`.

It:
1. Resolves the next unpublished Philippians verse.
2. Retrieves the SBLGNT Greek verse and KJV English verse.
3. Builds a research dossier and narrative map.
4. Writes a continuous 1,100–1,350 word sermon.
5. Evaluates Greek accuracy, biblical faithfulness, spoken naturalness, Christ-centeredness, and listener engagement.
6. Repairs and reevaluates when needed.
7. Publishes the verified written lesson to `scripture_devotional_lessons`.

V1 intentionally does not force the Genesis audio/visual tables to carry Greek content. Audio can be added later through a language-neutral media layer without corrupting the legacy Hebrew pipeline.

## Initial Philippians 1:1 controlling truth

Our deepest identity is not our title, location, or level of responsibility. We belong to Jesus Christ and live in him.
