# Feeder Capture Dashboard

An interactive dashboard for tracking and comparing feeder capture data across multiple asset types.

## Features

- **Upload Asset Files**: Mapped DT by GIS, HT Poles, LT Poles, Consumer Points, Issue Log
- **Feeder Lookup**: Map feeder codes to full names
- **Smart Matching**: Automatically matches short codes (e.g., "L36") to full feeder names
- **Date Range Filtering**: Generate reports for specific date ranges
- **Editable Reports**: Edit feeder names and values directly in the report
- **Auto-Merge**: When editing a feeder name to match an existing one, values are automatically merged
- **Save & Compare**: Save current report as previous week and compare week-over-week changes
- **Export to Excel**: Download reports as Excel files

## Deployment to GitHub Pages

### Option 1: Automatic Deployment (Recommended)

1. **Create a GitHub repository** and push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Build and deployment", select **GitHub Actions**
   - The workflow will automatically run and deploy your site

3. **Access your site** at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

### Option 2: Manual Deployment

1. **Build the project**:
   ```bash
   npm install
   npm run build
   ```

2. **Deploy using gh-pages**:
   ```bash
   npm install -D gh-pages
   npx gh-pages -d dist
   ```

3. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Select `gh-pages` branch as source

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## File Format Requirements

### Feeder Lookup (Excel)
| Column A | Column B |
|----------|----------|
| Feeder Code | Feeder Full Name |

### Asset Files (Excel)
Each file should have:
- A `time` or `Time` column for date filtering
- A feeder column (`feeder`, `_11kv_feeder`, or `_33kv_feeder`)

### Expected Columns by File Type:
- **Mapped DT**: `time`, `feeder`
- **HT Poles**: `time`, `_11kv_feeder`, `_33kv_feeder`
- **LT Poles**: `time`, `feeder`
- **Consumer Points**: `time`, `feeder`
- **Issue Log**: `time`, `feeder`

## Usage

1. **Upload Feeder Lookup** - One-time configuration
2. **Upload Asset Files** - Upload each file type separately
3. **Set Date Range** - Select start and end dates
4. **Generate Report** - Click the generate button
5. **Correct Feeders** - Fix any unmatched feeder names
6. **Edit as Needed** - Click on feeder names or values to edit
7. **Save as Previous Week** - Store for comparison
8. **Export** - Download as Excel file

## Technology Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- XLSX (SheetJS) for Excel parsing
- LocalStorage for data persistence
