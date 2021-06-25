import * as React from 'react';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import * as classNames from 'classnames';
import { DragSource, DragSourceCollector, DragSourceSpec, DropTarget, ConnectDragSource, ConnectDragPreview, ConnectDropTarget, DropTargetSpec, DropTargetCollector } from 'react-dnd';
import { Button, Tooltip } from '@patternfly/react-core';
import { GripVerticalIcon, MinusCircleIcon, PlusCircleIcon } from '@patternfly/react-icons';

import { DRAGGABLE_TYPE } from './draggable-item-types';
import withDragDropContext from './drag-drop-context';
import { LabelInput } from './label-input';
import { NameValueEditorPair } from './types';
import { ValueFromPair } from './value-from-pair';

const NameValueEditor_: React.FC<NameValueEditorProps_> = (props) => {
  const { t } = useTranslation();
  const {
    onChange,
    pairs,
    addString,
    readOnly = false,
    nameValueId = '0',
    toolTip,
    onLastItemRemoved,
    leftColumn,
    // pairElement,
  } = props;

  const append = () => {
    onChange(pairs.concat([['', '']]), nameValueId);
  }

  const remove = (i: number) => {
    const newPairs = _.cloneDeep(pairs);
    newPairs.splice(i, 1);
    onChange(newPairs.length ? newPairs : [['', '']], nameValueId);
    if (newPairs.length === 0 && !!onLastItemRemoved) {
      onLastItemRemoved();
    }
  }

  const change = (pair: [string, string], i: number) => {
    const newPairs = _.cloneDeep(pairs);
    newPairs[i] = pair;
    onChange(newPairs, nameValueId);
  }

  // if onLastItemRemoved is defined, then remove is always possible; else, depends on presence of non-empty items.
  const canRemove = !!onLastItemRemoved || pairs.length > 1 || pairs.every(p => !p[0] && !p[1]);

  const nameString = props.nameString || t('public~Key');
  const valueString = props.valueString || t('public~Value');
  return (
    <>
      <div className="row pairs-list__heading">
        {leftColumn}
        <div className="col-xs-5">{nameString}</div>
        <div className="col-xs-5">{valueString}</div>
        <div className="col-xs-1 co-empty__header" />
      </div>
      {pairs.map((pair: [string, string], i) => {
        return props.children({
          index: i,
          // key: `pair-${i}`,
          onChange: (pair: [string, string]) => change(pair, i),
          nameString: nameString,
          valueString: valueString,
          readOnly: readOnly,
          pair: pair,
          onRemove: canRemove ? () => remove(i) : undefined,
          toolTip: toolTip,
        });
      })}
      <div className="row">
        <div className="col-xs-12">
          {readOnly ? null : (
            <div className="co-toolbar__group co-toolbar__group--left">
              <Button
                className="pf-m-link--align-left"
                data-test="add-button"
                onClick={append}
                type="button"
                variant="link"
              >
                <PlusCircleIcon
                  data-test-id="pairs-list__add-icon"
                  className="co-icon-space-r"
                />
                {addString ? addString : t('public~Add more')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Internal properties hidding some implementation details
type NameValueEditorProps_ = NameValueEditorProps & {
  children: (props: PairElementProps) => React.ReactElement<any>,
  leftColumn?: JSX.Element,
};

export type NameValueEditorProps = {
  pairs: string[][],
  onChange: (pairs: string[][], nameValueId: string) => void,
  nameString?: string,
  valueString?: string,
  addString?: string,
  readOnly?: boolean,
  nameValueId?: string,
  toolTip?: string,
  onLastItemRemoved?: () => void,
};
export const SimpleNameValueEditor: React.FC<NameValueEditorProps> = (props) => (
  <NameValueEditor_ {...props} >
    {(childProps) => <PairElement {...childProps} />}
  </NameValueEditor_>
);
SimpleNameValueEditor.displayName = 'Name Value Editor';

export const DraggableNameValueEditor: React.FC<NameValueEditorProps> = withDragDropContext((props) => {
  const { pairs, nameValueId = "0", onChange, readOnly } = props;

  const swap = (index1: number, index2: number) => {
    const newPairs = _.cloneDeep(pairs);
    const pair1 = newPairs[index1];
    newPairs[index1] = newPairs[index2];
    newPairs[index2] = pair1;
    onChange(newPairs, nameValueId);
  }

  return (
    <NameValueEditor_
      {...props} 
      leftColumn={!readOnly && <div className="col-xs-1 co-empty__header" />}
    >
      {(childProps) => (
        <DraggablePairElement
          onMove={swap}
          rowSourceId={nameValueId}
          disableReorder={pairs.length < 2}
          {...childProps}
        />
      )}
    </NameValueEditor_>
  );
});

export const LabelsSelector: React.FC<NameValueEditorProps> = (props) => {
  const { pairs, readOnly } = props;
  const omitLabels = pairs.filter((p) => !!p[0]).map((p) => p[0]);

  return (
    <NameValueEditor_
      {...props} 
      leftColumn={!readOnly && <div className="col-xs-1 co-empty__header" />}
    >
      {(childProps) => (
        <PairElement {...childProps}>
          {(subchildProps) => (
            <LabelInput omitLabels={omitLabels} {...subchildProps} />
          )}
        </PairElement>
      )}
    </NameValueEditor_>
  );
};

const PairElement: React.FC<PairElementProps> = (props) => {
  const { t } = useTranslation();
  const {
    nameString,
    readOnly,
    pair,
    toolTip,
    valueString,
    onChange,
    onRemove,
    className = 'pairs-list__row',
    leftColumn,
  } = props;

  const deleteIcon = (
    <>
      <MinusCircleIcon className="pairs-list__side-btn pairs-list__delete-icon" />
      <span className="sr-only">{t('public~Delete')}</span>
    </>
  );

  const nameInputProps: NameInputElementProps = {
    placeholder: nameString,
    value: pair[NameValueEditorPair.Name],
    onChange: (name: string) => onChange([name, pair[NameValueEditorPair.Value]]),
    disabled: readOnly,
  };

  return (
    <div
      className={classNames('row', className)}
      data-test="pairs-list-row"
    >
      {leftColumn}
      <div className="col-xs-5 pairs-list__name-field">
        {props.children ? props.children(nameInputProps) : <StandardNameInput {...nameInputProps} />}
      </div>
      {_.isPlainObject(pair[NameValueEditorPair.Value]) ? (
        <div className="col-xs-5 pairs-list__value-pair-field">
          <ValueFromPair
            data-test="pairs-list-value"
            pair={pair[NameValueEditorPair.Value]}
            onChange={(e) => onChange([pair[NameValueEditorPair.Name], e.currentTarget.value])}
            disabled={readOnly}
          />
        </div>
      ) : (
        <div className="col-xs-5 pairs-list__value-field">
          <input
            type="text"
            data-test="pairs-list-value"
            className="pf-c-form-control"
            placeholder={valueString}
            value={pair[NameValueEditorPair.Value] || ''}
            onChange={(e) => onChange([pair[NameValueEditorPair.Name], e.currentTarget.value])}
            disabled={readOnly}
          />
        </div>
      )}
      {!readOnly && (
        <div className="col-xs-1 pairs-list__action">
          <Tooltip content={toolTip || t('public~Remove')}>
            <Button
              type="button"
              data-test="delete-button"
              className={classNames({
                'pairs-list__span-btns': true, // check this
              })}
              onClick={onRemove}
              isDisabled={!onRemove}
              variant="plain"
            >
              {deleteIcon}
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

type PairElementProps = {
  index: number,
  nameString?: string,
  valueString?: string,
  pair: [string, string],
  onChange: (pair: [string, string]) => void,
  onRemove?: () => void,
  toolTip?: string,
  readOnly: boolean,
  className?: string,
  leftColumn?: JSX.Element,
  children?: (props: NameInputElementProps) => React.ReactElement<any>,
};

type NameInputElementProps = {
  placeholder: string,
  value: string,
  onChange: (value: string) => void,
  disabled: boolean,
}

const StandardNameInput = (props: NameInputElementProps) => (
  <input
    type="text"
    data-test="pairs-list-name"
    className="pf-c-form-control"
    {...props}
    onChange={e => props.onChange(e.currentTarget.value)}
  />
);

type DraggablePairElementProps = DragItemProps & PairElementProps & {
  onMove: (index1: number, index2: number) => void,
  disableReorder: boolean,
  connectDragSource: ConnectDragSource,
  connectDragPreview: ConnectDragPreview,
  connectDropTarget: ConnectDropTarget,
  isDragging: boolean,
};

type DragItemProps = {
  index: number,
  rowSourceId: string,
}

const pairSource: DragSourceSpec<DraggablePairElementProps, DragItemProps> = {
  beginDrag(props, monitor, component) {
    console.log('===DRAG====');
    console.log(monitor);
    console.log(monitor.getItem());
    console.log(component);
    return {
      index: props.index,
      rowSourceId: props.rowSourceId,
    };
  },
};

const itemTarget: DropTargetSpec<DraggablePairElementProps> = {
  hover(props, monitor, component: React.ReactElement) {
    const dragIndex = monitor.getItem().index;
    const hoverIndex = props.index;
    // Don't replace items with themselves or with other row groupings on the page
    if (dragIndex === hoverIndex || monitor.getItem().rowSourceId !== props.rowSourceId) {
      return;
    }
    // Determine rectangle on screen
    console.log('===HOVER====');
    console.log(props);
    console.log(monitor);
    console.log(monitor.getItem());
    console.log(component);
    const hoverBoundingRect = (component as any)?.node?.getBoundingClientRect() || { bottom: 0, top: 0 };
    // Get vertical middle
    const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

    // Determine mouse position
    const clientOffset = monitor.getClientOffset();

    // Get pixels to the top
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;

    // Only perform the move when the mouse has crossed half of the items height
    // When dragging downwards, only move when the cursor is below 50%
    // When dragging upwards, only move when the cursor is above 50%

    // Dragging downwards
    if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
      return;
    }

    // Dragging upwards
    if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
      return;
    }

    // Time to actually perform the action
    props.onMove(dragIndex, hoverIndex);

    // Note: we're mutating the monitor item here!
    // Generally it's better to avoid mutations,
    // but it's good here for the sake of performance
    // to avoid expensive index searches.
    monitor.getItem().index = hoverIndex;
  },
};

type DragCollectedProps = {
  connectDragSource: ConnectDragSource;
  connectDragPreview: ConnectDragPreview;
  isDragging: boolean;
};
type DropCollectedProps = {
  connectDropTarget: ConnectDropTarget;
};

const collectSourcePair: DragSourceCollector<DragCollectedProps, {}> = (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
});

const collectTargetPair: DropTargetCollector<DropCollectedProps, {}> = (connect) => ({
  connectDropTarget: connect.dropTarget(),
});

const DraggablePairElement = DragSource<DragItemProps, DragCollectedProps>(
  DRAGGABLE_TYPE.ENV_ROW,
  pairSource,
  collectSourcePair,
)(
  DropTarget<DragItemProps, DropCollectedProps>(
    DRAGGABLE_TYPE.ENV_ROW,
    itemTarget,
    collectTargetPair,
  )((props: DraggablePairElementProps) => {
    const { t } = useTranslation();
    const {
      readOnly,
      disableReorder,
      connectDragSource,
      connectDragPreview,
      connectDropTarget,
      isDragging,
    } = props;
  
    //  const nodeRef = React.useRef(undefined as HTMLDivElement | undefined);
    const dragButton = (
      <div>
        <Button
          type="button"
          className="pairs-list__action-icon"
          tabIndex={-1}
          isDisabled={disableReorder}
          variant="plain"
          aria-label={t('public~Drag to reorder')}
        >
          <GripVerticalIcon className="pairs-list__action-icon--reorder" />
        </Button>
      </div>
    );
    return connectDropTarget(
      connectDragPreview(
        <div
        // ref="nodeRef" TODO
        >
          <PairElement
            {...props}
            className={isDragging && 'pairs-list__row-dragging'}
            leftColumn={!readOnly && (
              <div className="col-xs-1 pairs-list__action">
                {disableReorder ? dragButton : connectDragSource(dragButton)}
              </div>
            )}
          />
        </div>
      )
    );
  })
);
