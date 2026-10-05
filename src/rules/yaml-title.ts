import {Options, RuleType} from '../rules';
import RuleBuilder, {DropdownOptionBuilder, ExampleBuilder, OptionBuilderBase, TextOptionBuilder} from './rule-builder';
import dedent from 'ts-dedent';
import {dump} from 'js-yaml';
import {formatYAML, initYAML, toYamlString} from '../utils/yaml';
import {ignoreListOfTypes, IgnoreTypes} from '../utils/ignore-types';
import {escapeDollarSigns} from '../utils/regex';
import {insert} from '../utils/strings';

type TitleQuoteStyle = 'None' | 'Single Quote' | 'Double Quote';

class YamlTitleOptions implements Options {
  @RuleBuilder.noSettingControl()
    fileName: string;

  titleKey?: string = 'title';

  titleQuoteStyle?: TitleQuoteStyle = 'None';
}

@RuleBuilder.register
export default class YamlTitle extends RuleBuilder<YamlTitleOptions> {
  get OptionsClass(): new () => YamlTitleOptions {
    return YamlTitleOptions;
  }
  get name(): string {
    return 'YAML Title';
  }
  get description(): string {
    return 'Inserts the title of the file into the YAML frontmatter. Gets the title from the first H1 or filename if there is no H1.';
  }
  get type(): RuleType {
    return RuleType.YAML;
  }
  apply(text: string, options: YamlTitleOptions): string {
    text = initYAML(text);
    let title = ignoreListOfTypes([IgnoreTypes.code, IgnoreTypes.yaml, IgnoreTypes.link, IgnoreTypes.wikiLink, IgnoreTypes.tag], text, (text) => {
      const result = text.match(/^#\s+(.*)/m);
      if (result) {
        return result[1];
      }
      return '';
    });
    title = title || options.fileName;

    switch (options.titleQuoteStyle) {
      case 'Single Quote':
        title = dump(title, {lineWidth: -1, forceQuotes: true, quotingType: '\''}).slice(0, -1);
        break;
      case 'Double Quote':
        title = dump(title, {lineWidth: -1, forceQuotes: true, quotingType: '"'}).slice(0, -1);
        break;
      default:
        title = toYamlString(title);
    }

    return formatYAML(text, (text) => {
      const title_match_str = `\n${options.titleKey}.*\n`;
      const title_match = new RegExp(title_match_str);
      if (title_match.test(text)) {
        text = text.replace(
            title_match,
            escapeDollarSigns(`\n${options.titleKey}: ${title}\n`),
        );
      } else {
        const yaml_end = text.indexOf('\n---');
        text = insert(text, yaml_end, `\n${options.titleKey}: ${title}`);
      }

      return text;
    });
  }
  get exampleBuilders(): ExampleBuilder<YamlTitleOptions>[] {
    return [
      new ExampleBuilder({
        description: 'Adds a header with the title from heading.',
        before: dedent`
          # Obsidian
        `,
        after: dedent`
          ---
          title: Obsidian
          ---
          # Obsidian
        `,
        options: {
          fileName: 'Filename',
        },
      }),
      new ExampleBuilder({
        description: 'Adds a header with the title.',
        before: dedent`
          ${''}
        `,
        after: dedent`
          ---
          title: Filename
          ---
          ${''}
        `,
        options: {
          fileName: 'Filename',
        },
      }),
      new ExampleBuilder({
        description: 'Adds a header with the title wrapped in double quotes.',
        before: dedent`
          ${''}
        `,
        after: dedent`
          ---
          title: "Filename"
          ---
          ${''}
        `,
        options: {
          fileName: 'Filename',
          titleQuoteStyle: 'Double Quote',
        },
      }),
    ];
  }
  get optionBuilders(): OptionBuilderBase<YamlTitleOptions>[] {
    return [
      new TextOptionBuilder({
        OptionsClass: YamlTitleOptions,
        name: 'Title Key',
        description: 'Which YAML key to use for title',
        optionsKey: 'titleKey',
      }),
      new DropdownOptionBuilder<YamlTitleOptions, TitleQuoteStyle>({
        OptionsClass: YamlTitleOptions,
        name: 'Title Quote Style',
        description: 'The quote style used for the title value in the YAML frontmatter',
        optionsKey: 'titleQuoteStyle',
        records: [
          {
            value: 'None',
            description: 'The title is only quoted when YAML requires it: ```title: Title```',
          },
          {
            value: 'Single Quote',
            description: 'The title is always wrapped in single quotes: ```title: \'Title\'```',
          },
          {
            value: 'Double Quote',
            description: 'The title is always wrapped in double quotes: ```title: "Title"```',
          },
        ],
      }),
    ];
  }
}
