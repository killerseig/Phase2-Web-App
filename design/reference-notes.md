# Reference Notes

## Networking Application Reference

Source reviewed:

- `C:\Users\clarse12\Documents\GitHub\Networking-Application`

What to carry forward:

- permanent/collapsible left rail
- thin top bar
- thin status bar
- workbench-style center layout
- dense spacing
- restrained dark palette
- application feel over website feel
- pane-based workflows instead of large loose pages

What matters most is the shell and interaction model, not the specific feature set.

## Excel Timecards Reference

Sources reviewed:

- `customer files\P2_Time_Cards.xlsm`
- `customer files\Time Cards Filled Out\P2_Time_Cards - Filled Out.xlsm`
- timecard screenshots and instruction materials

Key behaviors observed:

- multiple employee cards visible at once
- alphabetical sorting
- create / delete / compact / de-compact behavior
- week/job controls at the top
- clear distinction between employee header info and weekly entry data
- built-in print and email workflows
- account summary area on the right

Important workbook observations:

- `H / P / C` rows map to hours, production, and cost
- production and cost rows are tied together by workbook formulas
- the structure is card-based, not record-list-based
- the layout is the product, not just the data

## Excel Shop Orders Reference

Sources reviewed:

- `customer files\P2_Field_Orders.xlsm`
- shop order screenshots

Key behaviors observed:

- top metadata area
- one large working list
- quick search
- special item entry
- comments on the same screen
- fast scan-and-type ordering workflow

Requested upgrade:

- add category browsing like a file explorer

## Daily Logs Reference

Sources reviewed:

- `customer files\Computer IT files\ForemanInstructional\Daily Logs`
- daily log screenshots
- prior web daily log implementation

Key behaviors observed:

- top site/project info section
- manpower table
- weekly schedule section
- long-form narrative sections
- recipient area and send action

Direction:

- preserve content structure
- modernize the UI into a much cleaner web form

## Old Phase 2 Web App Reference

Source reviewed:

- `C:\Users\clarse12\Documents\GitHub\Phase2-Web-App`

Useful pieces to keep conceptually:

- auth flow
- password setup flow
- daily log field grouping
- confirm/delete workflow

Pieces not to reuse directly:

- overall visual design
- current timecard interaction model

Reason:

- it already contains many needed elements, but the timecard flow drifted too far from the Excel sheet and the overall UI felt messy to users.
