# Exact Work source recovery — The Pure Android

- Installed origin: https://the-pure-android.greg-moulton2.chatgpt.site
- Original Work source commit: `fcde33a0062d2a51992552921e175de820ea56e2`
- Sites project: `appgprj_6af37580b974819199ed3e9d9b6a75f9`; saved version 1; successful deployment `appgdep_6af383405ea88191ba4ae11f809e96e0`.
- `source/` contains the 48 unmodified tracked files exported directly from that commit. `FILE-INVENTORY.tsv` and `SHA256SUMS` describe the exported files; verify from this directory with `sha256sum -c SHA256SUMS`.
- The 33 source-backed deployment payload files also matched the retained deployment archive byte for byte. The archive has one additional generated hosting manifest inside `dist/`, which is packaging output, not an original tracked source file.
- The export does not include browser storage, user workout records, Git metadata, or credentials. Tests and design mockups are tracked source artifacts. The original tracked hosting manifest is retained for provenance; this recovery snapshot is not a deployment instruction.
