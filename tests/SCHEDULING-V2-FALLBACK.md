# V2-compatible reserve artifact

Source lineage: independently checked Stage06 safe fallback commit
`5a69a481ad1adc0cc05df88f960d635499400dc1`, not the old vulnerable runtime.
Backported the reviewed Scheduling V2 API/schema/UI/test changes from
`de569b7072f8520a74a45839b8b7257de37e05fa` to preserve durable restrictions,
append-only history, notification dispatch state and all booking workflows.
Standard Docker runtime, alternate Webpack compiler; no production changes.

This is a separately committed and built reserve artifact, NOT an independent
implementation of V2 transaction logic. Backend/UI logic intentionally matches
the candidate. A common V2 logic defect needs a forward fix, not blind rollback
to this artifact or to the pre-V2 image. Never down-migrate schema021 or restore
a stale database over new records. Verify 47/9/21 and HTTP switch rehearsal on
isolated restored copies; no external providers or production credentials.
