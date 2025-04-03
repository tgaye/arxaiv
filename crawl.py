import os
import sys
import argparse

def should_skip_path(path):
    """Determine if a path should be skipped in the output"""
    parts = path.split(os.sep)
    
    # Skip common directories that add noise
    skip_dirs = [
        'node_modules', 'site-packages', '.git', '.webpack', 'dist',
        'out', 'build', 'coverage', '.nyc_output', '.vscode', '.github',
        'vendor', '__pycache__', '.next', '.nuxt'
    ]
    
    # Skip files that aren't useful for documentation
    skip_extensions = [
        '.map', '.log', '.lock', '.chunk.js', '.woff', '.woff2', '.eot', '.ttf',
        '.otf', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg'
    ]
    
    # Check directory exclusions
    for skip_dir in skip_dirs:
        if skip_dir in parts:
            return True
    
    # Check file exclusions
    if os.path.isfile(path):
        _, ext = os.path.splitext(path)
        if ext in skip_extensions:
            return True
        
        # Skip hidden files
        if os.path.basename(path).startswith('.'):
            return True
    
    return False

def get_lean_tree(root_dir, indent='', max_depth=5, current_depth=0):
    """Generate minimal ASCII tree without cruft"""
    if current_depth > max_depth:
        return ['    ' + indent + '... (max depth reached)']
    
    tree = []
    try:
        items = sorted(os.listdir(root_dir))
    except (PermissionError, FileNotFoundError):
        return []
    
    # Filter items first to get an accurate count for tree drawing
    filtered_items = [item for item in items if not should_skip_path(os.path.join(root_dir, item))]
    
    for i, item in enumerate(filtered_items):
        path = os.path.join(root_dir, item)
        
        # Skip if path matches exclusion criteria
        if should_skip_path(path):
            continue
        
        # Build tree line
        is_last = i == len(filtered_items) - 1
        prefix = '└── ' if is_last else '├── '
        tree.append(indent + prefix + item)
        
        # Only recurse for directories
        if os.path.isdir(path):
            new_indent = indent + ('    ' if is_last else '│   ')
            tree.extend(get_lean_tree(path, new_indent, max_depth, current_depth + 1))
    
    return tree

def main():
    parser = argparse.ArgumentParser(description='Generate a lean project structure tree')
    parser.add_argument('--title', help='Add LLM description header wrapped in **')
    parser.add_argument('--max-depth', type=int, default=5, help='Maximum directory depth to display')
    parser.add_argument('--output', default="PROJECT_STRUCTURE.txt", help='Output file name')
    args = parser.parse_args()
    
    root_dir = os.getcwd()
    
    with open(args.output, 'w', encoding='utf-8') as f:
        # Add LLM title if provided
        if args.title:
            f.write(f"** {args.title} **\n\n")
        
        f.write(f"{os.path.basename(root_dir)}/\n")
        tree_lines = get_lean_tree(root_dir, max_depth=args.max_depth)
        f.write('\n'.join(tree_lines))
    
    line_count = len(open(args.output, 'r', encoding='utf-8').readlines())
    print(f"✓ Lean structure saved to {args.output}")
    print(f"Total lines: {line_count}")

if __name__ == "__main__":
    main()