export interface ChecklistTemplate {
  id: string;
  name: string;
  items: string[];
  testSteps: string[];
}

/** Generic starting points for small businesses. They are NOT verified advice for any specific vendor or integration. */
export const TEMPLATE_DISCLAIMER =
  'Starting-point templates only. They are generic, unverified, and not advice for your specific vendor or integration. Edit every item to fit your situation.';

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'model-retirement', name: 'Model retirement or deprecation',
    items: ['Read the vendor announcement and note the effective date', 'List every place the model name is configured', 'Choose a replacement option and record why', 'Run the pre-migration tests against the replacement', 'Notify users of the planned change date', 'Switch configuration during an agreed window', 'Monitor results for the agreed period'],
    testSteps: ['Run a sample of 10+ real (non-sensitive) inputs through old and new setup', 'Compare outputs against the success criteria', 'Confirm cost per run matches the scenario assumptions'],
  },
  {
    id: 'price-increase', name: 'Price increase',
    items: ['Record current monthly spend and usage', 'Update scenario rates from the published pricing', 'Compare keep / modify / alternative / fallback options', 'Decide and get approval', 'Set a spend alert or review date'],
    testSteps: ['Verify the next invoice against the forecast'],
  },
  {
    id: 'vendor-outage', name: 'Vendor outage readiness',
    items: ['Document who declares an outage', 'Write the manual or fallback procedure', 'Name who informs affected users', 'Agree the trigger for switching to fallback', 'Record how to return to normal operations'],
    testSteps: ['Walk through the fallback procedure with the owner', 'Confirm fallback credentials or access exist before they are needed'],
  },
  {
    id: 'data-sensitivity', name: 'Data-sensitivity review before moving vendors',
    items: ['Confirm what data the workflow sends to the vendor', 'Check the alternative against your own data-handling requirements', 'Record unmet or unknown requirements', 'Obtain sign-off from the person responsible for data protection'],
    testSteps: ['Test with synthetic data only until review is complete'],
  },
];
