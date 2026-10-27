# OC-Connect — AI assistants

Source `screens/OC-Connect.dc.html` · Route `/settings/ai` · Specs 025, 024

## Layout
1. Back link "Menu".
2. Title "AI assistants"; lead "Let your AI save recipes and fill the grocery list for you. Each person connects their own."
3. One row per assistant: initial tile, name, status ("Connected · used {timeAgo}" in olive-deep, or "Not connected"), action "Manage" (muted link) or olive sm "Connect".
4. "What AI can do": caption "For the AI assistants you connect. Everyone in your family chooses for their own.", then a SettingRow with a switch per permission: "Create & edit recipes", "Change the grocery list", "Delete recipes" (on = allowed). One tap changes it (changed 2026-10-26 from the drawn "Allowed" values, which opened a choice). Settings are per person (apply to this member's assistants only).
5. Sage card "Try saying": “Save my mum's ratatouille to Our Cocon. It serves 4.” and “Add what I need for the quiche to our groceries.”

## Connect sheet (not drawn; BottomSheet)
Title "Connect {assistant}" · numbered steps (from spec 025) · read-only field with the Our Cocon address + "Copy" · ink "I've done this — check connection" · results "Connected!" (sage) or warn "Not connected yet. Check step 2 and try again."

Steps (checked against each assistant's help pages on 2026-10-26, spec 025 FR-005). Menu and button names (below in bold) are highlighted like amounts in recipe steps (StepCard › amount highlight). The address is `https://mcp.ourcocon.com/mcp` (LinkField, screen-reader name "Our Cocon address"; "Copied ✓" for 2 s).
- **Claude:** 1. "Copy the Our Cocon address below." 2. "In Claude, open **Customize › Connectors**, tap **+ Add**, then **Add custom connector**. Name it **Our Cocon**, paste the address, then tap **Continue** and **Add**." 3. "When Claude asks, sign in to Our Cocon and tap **Allow**."
- **ChatGPT:** 1. (same) 2. "In ChatGPT on the web, open **Plugins**, tap **+** and choose to add an MCP app. Name it **Our Cocon**, paste the address under **Connection**, keep **OAuth**, tick **I understand** and create it. No such option? Turn on **Developer mode** in **Settings › Security and sign-in** first." 3. "When ChatGPT asks, sign in to Our Cocon and tap **Allow**." Under the steps, caption ink-muted: "ChatGPT sometimes stops a request for a safety check. If that happens, just ask again."
- **Gemini:** 1. (same) 2. "On gemini.google.com, open **Settings › Connected Apps**. Under **Custom apps**, choose **Add a custom app**, paste the address and tap **Next**." 3. "When Gemini asks, sign in to Our Cocon and tap **Allow**." Under the steps, caption ink-muted: "For now, Gemini only offers this in the US, with a personal Google account."
- After "Connected!", the footer button reads "Close".

## Manage sheet (not drawn)
Title "{assistant}" · "Last used {timeAgo}" · the "What AI can do" rows (read-only; changed on the screen) · danger "Disconnect" → Dialog "Disconnect {assistant}?" · "It won't be able to see or change your recipes and groceries." · "Disconnect" / "Cancel".

## States
| State | Shows |
| --- | --- |
| Loading | The three rows with their tiles and names, no status or action |
| Couldn't load | warn Callout "Couldn't load your AI assistants. Check your connection and try again." + soft "Try again" |
| Used | "Connected · used just now" (under a minute) / "{n} min ago" / "{n} h ago" / "{n} day(s) ago"; before its first call, the time it was allowed |
| Not available yet | Status "Not available yet" (muted), no action; under the list, caption ink-muted "{assistant} can't connect to apps like Our Cocon yet. We'll add it here as soon as it can." |
| Another app | An app connected that isn't Claude, ChatGPT or Gemini (it can't be told apart by its return address): an extra row titled with the name it gave itself in quotes (“Claude Code”), or "Another AI app", honey tile with its first letter, "Connected · used {timeAgo}" and "Manage" |
| Permission not saved | the switch goes back; warn Callout above the rows "Couldn't save. Check your connection and try again." |
| Disconnect fails | warn Callout in the Manage sheet "Couldn't disconnect. Check your connection and try again." |
| Offline | OfflineBanner; "Connect", "Disconnect" and the permission switches are off |
| Settings › More | "AI assistants" row with "{n} connected ›" in olive-deep (nothing when none) |

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
