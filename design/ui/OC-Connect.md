# OC-Connect — AI assistants

Source `screens/OC-Connect.dc.html` · Route `/settings/ai` · Specs 025, 024

## Layout
1. Back link "Settings".
2. Title "AI assistants"; lead "Let your AI save recipes and fill the grocery list for you. Each person connects their own."
3. One row per assistant: initial tile, name, status ("Connected · used {timeAgo}" in olive-deep, or "Not connected"), action "Manage" (muted link) or olive sm "Connect".
4. "What AI can do": rows "Create & edit recipes" — "Allowed"; "Change the grocery list" — "Allowed"; "Delete recipes" — "Allowed". Values in olive-deep ("Allowed") or muted ("Not allowed"). Each row opens a choice of "Allowed" · "Not allowed". Settings are per person (apply to this member's assistants only).
5. Sage card "Try saying": “Save my mum's ratatouille to Our Cocon. It serves 4.” and “Add what I need for the quiche to our groceries.”

## Connect sheet (not drawn; BottomSheet)
Title "Connect {assistant}" · numbered steps (from spec 025) · read-only field with the Our Cocon address + "Copy" · ink "I've done this — check connection" · results "Connected!" (sage) or warn "Not connected yet. Check step 2 and try again."

## Manage sheet (not drawn)
"Last used {timeAgo}" · danger "Disconnect" → Dialog "Disconnect {assistant}?" · "It won't be able to see or change your recipes and groceries." · "Disconnect" / "Cancel".
