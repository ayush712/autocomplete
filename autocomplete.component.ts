import { Component, OnInit, Input, ViewChild, ElementRef, Output, EventEmitter, AfterViewInit, ChangeDetectionStrategy, ViewContainerRef, TemplateRef } from '@angular/core';

import { combineLatest, of, BehaviorSubject, fromEvent } from 'rxjs';
import { map, switchMap, debounceTime, takeUntil, skip, distinctUntilChanged } from 'rxjs/operators';
import { FormControl } from '@angular/forms';



@Component({
    selector: 'autocomplete',
    templateUrl: './autocomplete.component.html',
    styleUrls: [`./autocomplete.component.less`],
    changeDetection: ChangeDetectionStrategy.OnPush
})

export class AutoCompleteComponent implements AfterViewInit{
    @Input() set placeholder(value) {
        this._placeholder.next(value);
    }

    @Input() searchCallBack = null;

    @Input() set defaultSearchText(value) {
        this.textControl.setValue(value);
        this._searchTerm.next(value);
    }

    @Input() dropdownWidth;

    @Output() dataSelected = new EventEmitter();

    @ViewChild('container') container: ElementRef;

    @ViewChild('searchBox') searchBox: ElementRef;

    @ViewChild('dropDownContainer') dropDownContainer: ElementRef;

    @ViewChild('dropDown') dropDown: ElementRef;

    //placeholder observable
    placeholder$;
    //observable that emits input events
    searchTerm$;
    //observable that has results
    searchResult$;
    //observable that checks input has focus or not
    hasFocus$;
    //observable that checks the loading state
    loading$;
    //observable that checks dropdown is open or not
    dropdownOpen$;
    //focusindex Observable
    focusIndex$;
    //viewModel obseravble
    vm$;
    //Dropdown View model
    dropdownVm$;
    //text form control
    textControl = new FormControl();
    private _placeholder = new BehaviorSubject<String>('Search here');
    private _searchTerm = new BehaviorSubject<string>('');
    private _hasFocus = new BehaviorSubject<boolean>(false);
    private _loading = new BehaviorSubject<boolean>(false);
    private _focusIndex = new BehaviorSubject<number>(-1);
    private _ddOpen = new BehaviorSubject<boolean>(false);
    private _result = new BehaviorSubject<any[]>([]);
    private _bodyElem = document.getElementsByTagName('body')[0];
    constructor() {
        this._initObseravbles();
    }
    ngAfterViewInit() {
        this.dropdownWidth = this.dropdownWidth || this.container.nativeElement.offsetWidth;
    }
    onDropdownClick($event, text) {
        $event.stopPropagation();
        if ($event.target.dataset && $event.target.dataset.key) {
            this._reset();
            this.dataSelected.next({ id: $event.target.dataset.key, text: $event.target.dataset.value });
            this.textControl.setValue($event.target.dataset.value, { emitEvent: false });
        }
    }
    onBlur() {
        this._reset();
    }
    onTextBoxClick() {
        this._searchTerm.next(this.textControl.value);
        this._hasFocus.next(true);
    }
    onTextChange($event) {
        this._hasFocus.next(true);
        this._searchTerm.next($event);
    }
    onKeyUp($event, text) {
        switch ($event.which) {
            case 13: //ENTER
                this._onEnter($event, text);
                break;

            case 27: //ESC
                this._onEscape($event);
                break;

            default:
                break;
        }
    }
    onKeyDown($event) {
        switch ($event.which) {
            case 38: //UP
                $event.preventDefault();
                this._onArrowUp();
                break;

            case 40: //DOWN
                $event.preventDefault();
                this._onArrowDown();
                break;

            default:
                break;
        }
    }
    outsideClick($event) {
        $event.stopPropagation();
        this.onBlur();
    }
    onBtnClick() {
        if(this.textControl.value && this.textControl.value.trim()) {
            this.dataSelected.next({ id: null, text: this.textControl.value });
        }
    }
    trackById(index, item) {
        return item.id;
    }
    private _initObseravbles() {
        this.placeholder$ = this._placeholder.asObservable();
        this.searchTerm$ = this._searchTerm.asObservable();
        this.hasFocus$ = this._hasFocus.asObservable();
        this.loading$ = this._loading.asObservable();
        this.focusIndex$ = this._focusIndex.asObservable();
        this.searchResult$ = this.searchTerm$.pipe(
            debounceTime(200),
            distinctUntilChanged(),
            map(term => {
                this._loading.next(true);
                this._focusIndex.next(-1);
                return term;
            }),
            switchMap(term =>
                this.searchCallBack(term)
                    .pipe(
                        takeUntil(
                            this.searchTerm$.pipe(skip(1))
                        ),
                        map((result: any[]) => {
                            this._loading.next(false);
                            this._result.next(result);
                            return result;
                        })
                    )
            )
        );
        this.dropdownOpen$ = combineLatest([this.hasFocus$, this.searchResult$])
            .pipe(
                switchMap(([hasFocus, searchResult]: any[]) => {
                    return of(hasFocus && searchResult && searchResult.length)
                }),
                map((value) => {
                    this.setDropdown(!!value);
                    return value;
                })
            )
        this.vm$ = combineLatest([this.placeholder$, this.searchTerm$, this.loading$, this.focusIndex$])
            .pipe(
                map(([placeholder, searchTerm, loading, focusIndex]) => ({ placeholder, searchTerm, loading, focusIndex }))
            );
        
        this.dropdownVm$ = combineLatest([this.dropdownOpen$, this.searchResult$])
            .pipe(
                map(([dropdownOpen, searchResult]) => ({ dropdownOpen, searchResult }))
            );
    }
    private _onEscape($event) {
        $event.stopPropagation();
        this.onBlur();
    }
    private _onEnter($event, text) {
        $event.stopPropagation();
        if (this._focusIndex.value != -1) {
            this.textControl.setValue(this._result.value[this._focusIndex.value].text);
            this.dataSelected.next({ ...this._result.value[this._focusIndex.value] });
        } else {
            this.dataSelected.next({ id: null, text: text });
        }
        this.onBlur();
    }
    private _onArrowUp() {
        if (this._result.value.length) {
            let index = 0;
            if ((this._focusIndex.value == -1) || (this._focusIndex.value == 0)) {
                index = this._result.value.length - 1;
            } else {
                index = this._focusIndex.value - 1;
            }
            this._onArrowMove(index);
        }
    }
    private _onArrowDown() {
        if (this._result.value.length) {
            let index = 0;
            if ((this._focusIndex.value == (this._result.value.length - 1)) || (this._focusIndex.value == -1)) {
                index = 0;
            } else {
                index = this._focusIndex.value + 1;
            }
            this._onArrowMove(index);
        }
    }
    private _onArrowMove(index) {
        this._hasFocus.next(true);
        this._focusIndex.next(index);
        let item = this.dropDown.nativeElement.querySelector('li:nth-child(' + (index + 1) + ')');
        let itemPosition = this._getElementPosition(item);
        let dropdownPosition = this._getElementPosition(this.dropDown.nativeElement);
         //if item is above or below dropdown
        if (itemPosition.top < dropdownPosition.top
            || ((itemPosition.top + itemPosition.height) > (dropdownPosition.top + dropdownPosition.height))
            ) {
            item.scrollIntoView({ block: "nearest" });
        }
    }
    private _reset() {
        this._hasFocus.next(false);
        this._loading.next(false);
        this._focusIndex.next(-1);
    }
    private setDropdown(show) {
        if (show) {
            if (!this._ddOpen.value) {
                this._bodyElem.appendChild(this.dropDownContainer.nativeElement);
                let _textBoxPosition = this._getElementPosition(this.searchBox.nativeElement);
                this.dropDown.nativeElement.style.top = _textBoxPosition.top + _textBoxPosition.height + 'px';
                this.dropDown.nativeElement.style.left = _textBoxPosition.left + 'px';
            }
            this._ddOpen.next(true);
        } else {
            if (this.dropDownContainer && this._ddOpen.value) {
                this._bodyElem.removeChild(this.dropDownContainer.nativeElement);
            }
            this._ddOpen.next(false);
        }
    }
    private _getElementPosition(elem) {
        let rect = elem.getBoundingClientRect();
        let win = window;
        let docElem = elem.ownerDocument.documentElement;
        return {
            top: rect.top + win.pageYOffset - docElem.clientTop,
            left: rect.left + win.pageXOffset - docElem.clientLeft,
            height: rect.height
        };
    }
}
