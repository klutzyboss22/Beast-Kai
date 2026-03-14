Beast Kai Showdown-like Toolkit

Built only from:
Beast_Kai_Clean_Battle_Workbook_v11_rebalanced.xlsx

Included:
- beast_kai_showdown_like.html : self-contained local browser app
- data/*.json : normalized workbook exports
- showdown_data/*.js : Showdown-style data modules
- db/beast_kai.sqlite : SQLite database extracted from workbook

What works:
- team builder with legality checks from workbook fields
- dex browser for beasts, moves, and abilities
- type chart viewer
- damage calculator using workbook formula
- data package for future simulator work

What does not fully exist yet:
- a complete automated battle simulator
- scripted execution for every move / ability effect

Why:
The workbook stores many effects as free text, which is enough to transfer the data but not enough to auto-script every battle interaction exactly like Pokémon Showdown without manual rules coding.

Source policy:
All extracted content in this package came only from the workbook.
