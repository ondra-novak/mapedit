import type { DialogConstant } from "./dialog_structs";

type Fact = {
    id: number; // 1-255
    key: string; // short, human-readable identifier
    description: string;
};

export class FactDB {
    private factsById: Map<number, Fact> = new Map();
    
    addFact(key: string, description: string, enemy?:boolean): Fact | null {
        const newid = this.available(enemy);
        if (newid !== null) {
                const fact: Fact = { id:newid, key, description };
                this.factsById.set(newid, fact);
                return fact;            
        }    
        return null; // No available id
    }

    available(enemy?:boolean) : number | null{
        // Find first unused id between 1 and 255
        const from = enemy?0:16;
        const to  = enemy?8:256;
        for (let id = from; id < to; id++) {
            if (!this.factsById.has(id)) {
                return id;
            }
        }
        return null; // No available id

    }

    removeFactById(id: number): boolean {
        const fact = this.factsById.get(id);
        if (!fact) return false;
        this.factsById.delete(id);
        return true;
    }

    replaceFact(id: number, newKey: string, newDescription: string): Fact | null {
        const oldFact = this.factsById.get(id);
        if (!oldFact) return null;
        const newFact: Fact = { id, key: newKey, description: newDescription };
        this.factsById.set(id, newFact);
        return newFact;
    }

    getFactById(id: number): Fact | undefined {
        return this.factsById.get(id);
    }


    getAllFacts(): Fact[] {
        return Array.from(this.factsById.values());
    }
    asDlgConsts()  {
        return this.getAllFacts().reduce((a,b)=>{
            a[b.key] = {value:b.id, desc:b.description};
            return a;
        },{} as Record<string, DialogConstant>)
    }
    toJSON(): string {
        return JSON.stringify(this.getAllFacts());
    }

    static fromJSON(json: string): FactDB {
        const facts: Fact[] = JSON.parse(json);
        const db = new FactDB();
        for (const fact of facts) {
            // Ensure id/key uniqueness and id range
            if (
                typeof fact.id === 'number' &&
                fact.id >= 0 &&
                fact.id < 256 &&
                typeof fact.key === 'string' &&
                typeof fact.description === 'string' &&
                !db.factsById.has(fact.id)
            ) {
                db.factsById.set(fact.id, fact);
            }
        }
        return db;
    }
}