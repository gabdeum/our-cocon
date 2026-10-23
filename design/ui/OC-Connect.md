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

## Approve access (not drawn; page, spec 023)
Route `/oauth/consent?authorization_id=…`. Supabase's OAuth server sends the member here when an assistant connects. Built from WelcomeHeader (logo, title, lead), Text, Callout and Button.
- Title "Let {assistant} use Our Cocon?" ({assistant} is the name the assistant registered with, or "Your AI assistant"); lead "It will see and change your family's things in Our Cocon, like recipes and the grocery list, as you. You can disconnect it any time in Settings › AI assistants."
- The title names the assistant only when its return address proves it (claude.ai → Claude, the same rule that names its writes). Otherwise it quotes the name the app gave itself: "Let “{name}” use Our Cocon?". When that name claims to be a known assistant, a warn Callout above the line: "This app calls itself {name}, but it would send you back to {host}. Only allow it if you trust {host}."
- Line in ink-muted: "After this you'll go back to {host}." (where the code goes: what tells a real assistant from one using its name).
- Ink block "Allow" (busy "Connecting…"), then soft block "Don't allow".
- After: info Callout "All set. You can go back to {assistant}." or "{assistant} wasn't given access.", while the page sends the member back.
- Already allowed before: straight back to the assistant, nothing shown.
- Signed out: Sign in (OC-Welcome) with title "Sign in to connect your AI assistant", lead "Then you'll choose whether it can use Our Cocon.", coming back here.
- Old, used or malformed request: warn Callout "This request has expired. Go back to your AI assistant and connect again."
- Allow or Don't allow fails: warn Callout "Couldn't connect. Check your connection and try again."
