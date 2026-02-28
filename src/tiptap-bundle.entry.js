/**
 * tiptap-bundle.entry.js — Bundles all TipTap packages into window.TiptapBundle.
 */
import { Editor } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CodeBlock } from '@tiptap/extension-code-block';

window.TiptapBundle = { Editor, StarterKit, Underline, TextStyle, Color, Highlight, Table, TableRow, TableCell, TableHeader, Link, Image, Placeholder, CodeBlock };
