'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { 
    Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, 
    Heading1, Heading2, List, ListOrdered, AlignLeft, 
    AlignCenter, AlignRight, Undo, Redo 
} from 'lucide-react';

interface TipTapEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

export default function TipTapEditor({ content, onChange, placeholder = 'Введите текст...' }: TipTapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: content || '',
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
            },
        },
    });

    if (!editor) {
        return <div className="p-4 border rounded-lg">Загрузка редактора...</div>;
    }

    const toggleLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL:', previousUrl);

        if (url === null) {
            return;
        }

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {/* Панель инструментов */}
            <div className="flex flex-wrap gap-1 p-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
                    title="Жирный"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
                    title="Курсив"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
                    title="Подчёркнутый"
                >
                    <UnderlineIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''}`}
                    title="Заголовок 1"
                >
                    <Heading1 className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}`}
                    title="Заголовок 2"
                >
                    <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
                    title="Список"
                >
                    <List className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
                    title="Нумерованный список"
                >
                    <ListOrdered className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`}
                    title="Выровнять по левому краю"
                >
                    <AlignLeft className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`}
                    title="По центру"
                >
                    <AlignCenter className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`}
                    title="По правому краю"
                >
                    <AlignRight className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                    type="button"
                    onClick={toggleLink}
                    className={`p-2 rounded hover:bg-gray-200 transition ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
                    title="Ссылка"
                >
                    <LinkIcon className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    className="p-2 rounded hover:bg-gray-200 transition"
                    title="Отменить"
                >
                    <Undo className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    className="p-2 rounded hover:bg-gray-200 transition"
                    title="Повторить"
                >
                    <Redo className="w-4 h-4" />
                </button>
            </div>

            {/* Редактор */}
            <EditorContent editor={editor} />
        </div>
    );
}
