# Skeldal Dialog Script

## Format

Dialog scripts consist of expressions separated by semicolons:

```
expression;
expression;
expression;
```

## Variable Assignment

Assign values to variables using the `:=` operator:

```
var := expression;
```

## Function Calls

Call functions with arguments in parentheses:

```
function_name(arg1, arg2, arg3)
```

## Expressions

Expressions support standard arithmetic operators with proper precedence:

```
a + b * 2 * (c + d)
```

**Important:** All variables are **16-bit signed integers** with range -32768 to 32767. Overflow causes wrap-around. However, expressions are calculated using 64-bit arithmetic internally, allowing safe intermediate calculations.

## Conditions and Branching

Conditions use logical operators (`&&`, `||`) and comparison operators (`==`, `!=`, `>=`, `<=`, `<`, `>`):

```
a == b
```

There is no `if` statement. Instead, use code blocks as expressions:

**If-then pattern:**
```
condition && {
    command1;
    command2;
}
```

**If-then-else pattern:**
```
condition && {
    command1;
    true
} || {
    command2;
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
- **game_time** - containe game time (1 tick per 10 sec). Note this number is probably larger than 32768, so you will need to perform some adjustment before can be stored

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
 - **timepass(seconds, game_hours)** - dark screen for given seconds, game time passes game_hours
 - **eat(price)** - add food and water to all characters in given dialog, price for each
 - **change_music(str)** - change music - changes current music. When music finished, continues in playlist
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
 - **kill_current_enemy()** - kills current enemy (disables kill dialog, displays effects, drops loot)
 - **set_speaker_by_face(slot, face_id)** - set speaker's slot by face (variable can be used) 
 - **printf(s,...)** - output text to window, where s is pattern and arguments are variable count depend on pattern: printf("chance is {} of {}", a, b)
 - **str(n)** - function can be used instead of string, where n is refers to global string table. n must be constant. Invalid use causes crash
 - **exit()** - exit current dialog regardless on where it is
 - **goto_node(n)** - directly continue to specified node (must be constant)
 - **goto_story(n)** - directly continue to specified story (must be constant)
 - **has_spell_group(n)** - returns true if current speaker has active a spell from given spell group. 
 - **end_spell_group(n)** - end any spell of specified group.

