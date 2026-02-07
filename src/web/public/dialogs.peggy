{
  function bin(left, op, right) {
    return { type: "binary", op, left, right };
  }
}

Code
  = Sequence
  
Sequence 
  = first:Assignment
    rest:(
      _ ";" _ stmt:Assignment { return stmt; }
    )*
    _ ";"?
  {
    return {
      type: "sequence",
      commands: [first, ...rest]
    };
  }

  
Assignment 
  = left:Identifier _ ":=" _ right: Expression {
  return bin(left, ":=" , right);
} / Expression

Expression = Comparison

Comparison 
  = left:LogicalAnd _ op:("<" / ">" / "<=" / ">=" / "==" / "!=" ) _ right: Comparison {
  	return bin(left, op, right);
  } / LogicalOr

LogicalOr
  = left:LogicalAnd _ "||" _ right:LogicalOr {
      return bin(left, "||", right);
    }
  / LogicalAnd

LogicalAnd
  = left:Additive _ "&&" _ right:LogicalAnd {
      return bin(left, "&&", right);
    }
  / Additive

Additive
  = left:Multiplicative _ op:("+" / "-") _ right:Additive {
      return bin(left, op, right);
    }
  / Multiplicative

Multiplicative
  = left:Primary _ op:("*" / "/") _ right:Multiplicative {
      return bin(left, op, right);
    }
  / Primary

Primary
  = Call
  / Number
  / String
  / Identifier
  / "(" _ Expression _ ")"
  / "{" _ Sequence _ "}"
  / "+" _ Number 
  / "-" _ arg:Number {return {type:"call","name":"unar_minus","args":[arg]}; }

Call
  = name:Identifier _ "(" _ args:Arguments? _ ")" {
      return {
        type: "call",
        name: name.name,
        args: args !== null ? args : []
      };
    }

Arguments
  = head:Expression tail:(_ "," _ Expression)* {
      return [head, ...tail.map(t => t[3])];
    }

Identifier
  = name:$(IdentStart IdentPart*) {
      return { type: "identifier", name };
    }

Number
  = value:$([0-9]+) {
      return { type: "number", value: parseInt(value, 10) };
    }

String
  = "\"" chars:$(Char*) "\"" {
      return { type: "string", value: chars };
    }

IdentStart
  = [a-zA-Z_]

IdentPart
  = [a-zA-Z0-9_]

Char
  = !("\"") .

_ "whitespace"
  = [ \t\n\r]*
