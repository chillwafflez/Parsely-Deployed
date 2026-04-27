## My Ideas: 
- Support for other types of documents like tax forms, bank statements, pay stubs, mortgage forms, etc. 
- Extract table data 

## Markus’ Ideas: 
- Improve the schema aspect 
  - Side popout screen or secondary screen allowing the user to manipulate the data in a very easy way 
  - Using AI to apply regex to fields (“All the emails on our invoices need to have a ‘+1’ added at the end, so apply that to every extracted email”) 
- Refine the exports 
  - Make it easy for regular people 
  - Make it more in-depth for more technical/code-savvy people (love working with JSONs) 
- Teams Tab app or Teams Message Extension 
  - If Message Extension, you can have users drag a PDF or document in easily for parsing 
- Additional Table support 
  - Able to parse tables into Excel tables/tabular data 
  - Able to easily fill out a table on a PDF by dropping in a bunch of text (most likely structured text) and having it autofill the table 
  - Drag and drop a picture of a table, and have it parse the table out of the picture into tabular format (CSV or Excel) 

## Claude’s Ideas: 
- Conditional fields: a field only appears/is required based on the value of another field (e.g. “If entity type = LLC, show EIN field”) 
- Field validation rules: attach validation logic to a field (regex, date range, numeric range) so bad extractions are flagged immediately 
- Webhook/API output: push extracted data to a URL automatically after a successful parse, enabling integration with any downstream system 