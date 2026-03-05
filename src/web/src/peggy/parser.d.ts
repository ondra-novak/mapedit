export interface Location {
    start: {
        offset: number;
        line: number;
        column: number;
    };
    end: {
        offset: number;
        line: number;
        column: number;
    };
}

export interface GrammarError extends Error {
    location?: Location;
}

export type StartRules = string[];

export function parse(
    input: string,
    options?: {
        startRule?: StartRules[number];
    }
): any;

export class SyntaxError extends Error {
    location?: Location;
}
