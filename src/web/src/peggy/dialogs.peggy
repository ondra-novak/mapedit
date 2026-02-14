{
  function node( op, ...args) {
    return [op, ...args] ;
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
    return node( ";",first,...rest);          
  }

  
Assignment 
  = left:Identifier _ ":=" _ right: Expression {
  return node(":=" , left, right);
} / Expression

Expression = Comparison

Comparison 
  = left:LogicalAnd _ op:("<" / ">" / "<=" / ">=" / "==" / "!=" ) _ right: Comparison {
  	return node( op, left, right);
  } / LogicalOr

LogicalOr
  = left:LogicalAnd _ "||" _ right:LogicalOr {
      return node("||", left, right);
    }
  / LogicalAnd

LogicalAnd
  = left:Additive _ "&&" _ right:LogicalAnd {
      return node( "&&", left, right);
    }
  / Additive

Additive
  = left:Multiplicative _ op:("+" / "-") _ right:Additive {
      return node( op, left, right);
    }
  / Multiplicative

Multiplicative
  = left:Primary _ op:("*" / "/") _ right:Multiplicative {
      return node( op,left, right);
    }
  / Primary

Primary
  = Call
  / Number
  / String
  / Identifier
  / "(" _ a:Expression _ ")" {return a;}
  / "{" _ a:Sequence _ "}" {return a;}
  / "+" _ a:Number  {return a;}
  / "!" _ a:Number  {return node("!", arg);}
  / "-" _ arg:Number {return node("--", arg); }

Call
  = name:Identifier _ "(" _ args:Arguments? _ ")" {
      return node("call", name, ...args);
    }

Arguments
  = head:Expression tail:(_ "," _ Expression)* {
      return [head, ...tail.map(t => t[3])];
    }

Identifier
  = name:$(IdentStart IdentPart*) {
      return node("id", name );
    }

Number
  = value:$([0-9]+) {
      return node("num", parseInt(value, 10));
    }

String
  = "\"" chars:$(Char*) "\"" {
      return node( "str", chars );
    }

IdentStart
  = [a-zA-Z_]

IdentPart
  = [a-zA-Z0-9_.]

Char
  = !("\"") .

_ "whitespace"
  = [ \t\n\r]*
