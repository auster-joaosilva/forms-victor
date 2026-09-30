export interface MigrationStatus {
  applied(): Promise<string | null>
  expected(): Promise<string | null>
}
