# Sample knowledge documents

Three Arabic `.txt` files, in the shape the knowledge base is meant to be fed: **one file, one
workflow**. They exist so a fresh installation can be seen working end to end before anybody
has written real documentation, and so the manual verification in the main README has
something concrete to upload.

| File | Upload as | Notes |
|---|---|---|
| `global-delivery-handover.txt` | **GLOBAL**, module `DELIVERY`, page key `agent.delivery.details` | Carries a YouTube link, so it exercises video extraction |
| `tenant-discount-policy.txt` | **TENANT**, any company, module `ADMIN` | Contains a unique phrase (`زعفران-7741`) — useful for proving another tenant cannot retrieve it |
| `tenant-accounting-reversals.txt` | **TENANT**, same company, roles `ACCOUNTANT` + `TENANT_ADMIN` | Proves role filtering: an agent in that same company cannot retrieve it |

These are illustrations, not real policy. Replace them.

## Writing a good one

* One feature or workflow per file. The chunker keeps a short document whole, and a document
  that stays whole is a document whose steps stay in order.
* Put the title on the first line, alone. It becomes the heading repeated into every chunk of
  a long document, and the upload form offers it as the document title.
* Write the steps in the order they are performed, and use the words that are actually on the
  screen — the assistant is told to reuse the interface's vocabulary, and it can only reuse
  what it was given.
* Put a video link on its own line under a caption line ending in a colon, e.g.
  `فيديو الشرح:`. The caption becomes the label on the button.
* UTF-8, no BOM required (one is tolerated).
