import '@jackwener/opencli/registry'

declare module '@jackwener/opencli/registry' {
  interface CliCommand {
    defaultFormat?: 'table' | 'plain' | 'json' | 'yaml' | 'yml' | 'md' | 'markdown' | 'csv'
  }

  interface CliOptions {
    defaultFormat?: 'table' | 'plain' | 'json' | 'yaml' | 'yml' | 'md' | 'markdown' | 'csv'
  }
}

export {}
