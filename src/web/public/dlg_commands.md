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
- **first_visited** - contains true, if current dialog node is visited for the first time. Contains false otherwise
- **whole_group** - contains true, if all characters are participating in current dialog
- **slot_count** - contains count of used slots in current party 1-6
- **is_present** - contains true, if current character is present - applicable to non-random speakers
- **money** - contains money
- **is_female** - contains true, if current character is female
- **is_male** - contains true, if current character is male
- **character_sector** - contains sector of current character - applicable to non-random speakers - negative if at different map

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
 - **destroy_item(n)** - destroy item (if have_item returns true)
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
 


