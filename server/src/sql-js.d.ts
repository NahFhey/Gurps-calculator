declare module 'sql.js' {
  /** A value SQLite hands back or accepts as a bound parameter. */
  export type SqlValue = string | number | null | Uint8Array;

  export interface Database {
    run(sql: string, params?: SqlValue[]): void;
    prepare(sql: string): Statement;
    /** Rows changed by the most recent INSERT, UPDATE or DELETE. */
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: SqlValue[]): void;
    step(): boolean;
    getAsObject(): Record<string, SqlValue>;
    free(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
