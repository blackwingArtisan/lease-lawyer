declare module 'tau-prolog' {
  namespace pl {
    namespace type {
      class Var {
        id: string;
      }
      class Num {
        value: number;
        is_float: boolean;
      }
      class Term {
        id: string;
        args: Array<Term | Num | Var>;
        toString(): string;
      }
      class Substitution {
        links: Record<string, Term | Num | Var>;
        lookup(name: string): Term | Num | Var | null;
      }
      class Session {
        consult(program: string, options: ConsultOptions): void;
        query(goal: string, options: { success?: () => void; error?: (err: Term) => void }): void;
        answer(options: {
          success?: (answer: Substitution) => void;
          fail?: () => void;
          error?: (err: Term) => void;
          limit?: () => void;
        }): void;
        format_answer(answer: unknown): string;
      }
    }
    interface ConsultOptions {
      success?: () => void;
      error?: (err: type.Term) => void;
      text?: boolean;
      file?: boolean;
      url?: boolean;
      html?: boolean;
      script?: boolean;
    }
    function create(limit?: number): type.Session;
  }
  export default pl;
}

declare module '*.pl?raw' {
  const text: string;
  export default text;
}

declare module 'tau-prolog/modules/core.js?url' {
  const url: string;
  export default url;
}
