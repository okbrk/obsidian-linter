import {Options, RuleType} from '../rules';
import RuleBuilder, {ExampleBuilder, OptionBuilderBase} from './rule-builder';
import dedent from 'ts-dedent';
import {IgnoreTypes} from '../utils/ignore-types';
import {getAllTablesInText, getListItemTextPositions} from '../utils/mdast';
import {collectUnprotectedRegexReplacements, ProtectedRanges} from '../utils/protected-ranges';
import {checklistBoxStartsTextRegex} from '../utils/regex';
import {replaceTextRanges, textReplacement} from '../utils/strings';

class RemoveMultipleSpacesOptions implements Options {}

@RuleBuilder.register
export default class RemoveMultipleSpaces extends RuleBuilder<RemoveMultipleSpacesOptions> {
  constructor() {
    super({
      nameKey: 'rules.remove-multiple-spaces.name',
      descriptionKey: 'rules.remove-multiple-spaces.description',
      type: RuleType.CONTENT,
      ruleIgnoreTypes: [IgnoreTypes.code, IgnoreTypes.inlineCode, IgnoreTypes.math, IgnoreTypes.inlineMath, IgnoreTypes.yaml, IgnoreTypes.link, IgnoreTypes.wikiLink, IgnoreTypes.tag, IgnoreTypes.image],
    });
  }
  get OptionsClass(): new () => RemoveMultipleSpacesOptions {
    return RemoveMultipleSpacesOptions;
  }
  apply(text: string, options: RemoveMultipleSpacesOptions, protectedRanges: ProtectedRanges): string {
    const replaceSpaces = (match: RegExpMatchArray, startIndex: number): textReplacement => ({
      startIndex: startIndex + match[1].length,
      endIndex: startIndex + match[0].length - match[3].length,
      value: ' ',
    });
    const replacements = collectUnprotectedRegexReplacements(
        text, /(?!^>)([^\s])( ){2,}([^\s])/gm,
        protectedRanges.combinedWith([IgnoreTypes.list]), {editRange: replaceSpaces, guardRange: replaceSpaces},
    );

    for (const {position} of getListItemTextPositions(text)) {
      let startIndex = position.start.offset;
      // Preserve marker spacing and fallback checklist handling.
      while (startIndex > 0 && text.charAt(startIndex - 1).trim() === '') {
        startIndex--;
      }
      if (startIndex === 0 || text.charAt(startIndex - 1).trim() !== '') {
        startIndex++;
      }
      if (checklistBoxStartsTextRegex.test(text.substring(startIndex, position.end.offset))) {
        startIndex += 4;
      }

      replacements.push(...collectUnprotectedRegexReplacements(
          text.substring(startIndex, position.end.offset), /([^\s])( ){2,}([^\s])/gm,
          protectedRanges, {editRange: replaceSpaces, guardRange: replaceSpaces}, startIndex,
      ));
    }

    // Spaces next to a table cell's pipe are column alignment padding, so only spaces inside of cell content are collapsed.
    const tables = getAllTablesInText(text);
    const editableReplacements = tables.length === 0 ? replacements : replacements.filter((replacement) => {
      const inTable = tables.some((table) => replacement.startIndex >= table.startIndex && replacement.endIndex <= table.endIndex);

      return !inTable || (text.charAt(replacement.startIndex - 1) !== '|' && text.charAt(replacement.endIndex) !== '|');
    });

    // Paragraph edits are disjoint, and the document pass excludes all lists.
    editableReplacements.sort((a, b) => a.startIndex - b.startIndex);
    return replaceTextRanges(text, editableReplacements);
  }
  get exampleBuilders(): ExampleBuilder<RemoveMultipleSpacesOptions>[] {
    return [
      new ExampleBuilder({
        description: 'Removing double and triple space.',
        before: dedent`
          Lorem ipsum   dolor  sit amet.
        `,
        after: dedent`
          Lorem ipsum dolor sit amet.
        `,
      }),
    ];
  }
  get optionBuilders(): OptionBuilderBase<RemoveMultipleSpacesOptions>[] {
    return [];
  }
}
