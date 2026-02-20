# Skeldal Dialog script

## formát

```
expression;
expression;
expression;
```

## Přiřazení

```
var:=expression;
```

## Funkce

```
function_name(arg1,arg2,arg3)
```

### Expression

```
a + b * 2 * (c + d)
```

### conditions and branching

Condition is just expression consists from && and ||. You can use comparison operators ==, !=, >=, <=, < , >

This can be condition
```
a == b
```

There is no `if` command. If you need branch, you can use sequence as expression

if (cond) { command; command }

```
cond && {
    command1;
    command2;
}
```


if (cond) command1; else command2


```
cond && {
    command1;
    true 
} || {
    command2
}
```

### Predefined variables

- **stat.%** - access current character's stat attribute. You can only read this value
-- stat.strength, stat.dexterity, stat.magic, stat.movement
- **equipment.%** - access to equipment of the current character
- **weapon_bonus.%** - access to weapon bonus of the current character
- **face_id** - retrieve current characted face id
- **first_visited** - contains true, if current node was visited for first time 
- **whole_group** - contains true, if all characters are participating in current dialog
- **slot_count** - contains count of used slots in current party 1-6
  **slot_present** - contains count of presented characters
- **is_present** - contains true, if current character is present - applicable to non-random speakers
- **money** - contains money
- **gender** - 0 = male, 1 = female
- **character_sector** - contains sector of current character - applicable to non-random speakers - negative if at different map
- **enemy** - contains true if dialog is associated with an enemy (there is current enemy)
- **north** - 0
- **east** - 1
- **south** - 2
- **west** - 3
- **true** - contains true value, which is stored as 1 , but use this in conditions instead numbers
- **false** - contains false value, which is stored as 0 , but use this in conditions instead numbers
- **position.sector** - contains current sector
- **position.direction** - contains current direction
- **battle** - contains true, if currently in battle
- **held_item** - contains id of item held before dialog started. This item is no longer held, it was put into inventory. -1 for none

### Functions

 - **have_item(item)** - returns true, if current party has given item in possession
 - **have_money(n)** - returns true, if party has n money
 - **pay(n)** - reduce party balance
 - **add_money(n)** - increase party balance
 - **set_flag(n)** - set_enemy flag (16 reserved flags - see below) - only if dialog is associated with enemy
 - **is_flag(n)** - query enemy flag - only if dialog is associated with enemy
 - **reset_flag(n)** - reset_enemy flag (16 reserved flags - see below) - only if dialog is associated with enemy
 - **set_fact(n)** - sets fact
 - **reset_fact(n)** - resets fact
 - **is_fact(n)** - query fact
 - **get_lever(s,d)** - determine lever position on given side (sector, direction)
 - **send_action(s,d)** - send action to sector and direction
 - **teleport_group(s,d)** - teleport party to sector side
 - **load_level(n,s,d)** - transfer party to different level (name, sector, dir)
 - **teleport_character(n,s,d)** - teleport current character to different level (name, sector, dir), making them inaccessible until party reaches the level
 - **create_item(n)** - create item and give it to party
 - **destroy_item(n)** - destroy item (if have_item returns true). 
 - **add_to_book(n)** - copy book page (n - page)
 - **select_speaker(n)** - make speaker as current
 - **set_speaker(n)** - set current character as speaker at given slot
 - **join_character(n)** - add character to party
 - **drop_character()** - remove character from party
 - **have_rune(nm)** - check rune nm, for example 15 - type water, 5th rune
 - **set_rune(nm)**
 - **sleep(hours)** - perform party rest for hours
 - **practice_to(stat.%, value)** - sets stat to given value
 - **timepass(seconds, game_hours)** - dark screen for given seconds, game time passes game_hours
 - **eat(price)** - add food and water to all characters in given dialog, price for each
 - **change_music(str)** - change music - playlist "song1 song2 song3..."
 - **play_sound(str)** - play sound effect
 - **replace_monster(m)** - replace current moster by different monster
 - **replace_monsters(m,n)** - replace all monsters m in level by monsters n
 - **replace_monsters_radius(m,n,s,r)** - replace all monsters m in level by monsters n on sector (s) and given radius (r) in squares
 - **teleport_enemies(f,t,d)** - teleport enemies from sector `f` to sector `t`, direction `d`
 - **teleport_current_enemy(t,d)** - teleport current enemy to sector `t`, direction `d`
 - **send_enemy(f, t)** - send any enemy from sector `f` to sector `t`. The path must exist. When enemy can't reach the target, path is discarded
 - **send_current_enemy(t)** - send current enemy to sector `t`
 - **cast_spell(n)** - cast given spell, it is casted current character.
 - **cast_to_enemy(n)** - cast given spell to current enemy 
 - **enable_global_map(b)** - enable or disable global map
 - **visited(n)** - returns true, when node n has already been visited. N is local node ID  


