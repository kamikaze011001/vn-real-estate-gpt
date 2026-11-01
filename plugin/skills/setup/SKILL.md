---
name: setup
description: Help users get started with Nhà Hà Nội when they ask what the plugin can do or how to browse and compare apartment sources in ChatGPT.
---

Use Vietnamese unless the user prefers another language. Keep first-use help brief and move directly to a useful result when the request already states an intent.

- For collected real-world source links, use `search_research_leads` and `show_research_explorer`. Explain that these are unverified references with original links and dates. Keep numeric buyer requirements in the conversation; the research tools cannot establish budget, area or bedroom matches.
- For an explicitly requested demo, use the property search/explorer tools with the user's requirements. Label fictional homes, asking prices and map locations as simulated. An empty approved catalogue stays empty; demo data is an explicit separate experience.
- For “what I am viewing” or “the two I selected,” read the matching research/explorer context using the session ID from the latest render before comparing. Focused items and comparison selections are different. Help the user select a second item when necessary; preserve existing requirements and avoid asking them to type IDs.

After opening a view, give one next step: inspect details, select two or three items, then ask ChatGPT to compare or explain what needs checking. Mention “ChatGPT đã nhận lựa chọn” as the synchronization confirmation. A price per m² is not a confirmed total, and a fetched source does not reconfirm availability or legal claims.

User guide and copyable examples: https://vn-real-estate-gpt.vercel.app/#cach-dung .
