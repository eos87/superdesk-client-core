export default angular.module('superdesk.core.upload.imagemodify', [
    'superdesk.core.translate'
])

.directive('sdImageModify', function () {
    return {
        scope: {
            src: '=',
            original: '=',
            brightness: '=',
            contrast: '=',
            grayscale: '=',
            rotate: '='
        },
        template: '<canvas id="image"></canvas>',
        link: function (scope) {
            let canvas = document.getElementById('image'),
                context = canvas.getContext('2d'),
                base_image = new Image(),
                filter = {
                    brightness: scope.brightness ? 'brightness(' + scope.brightness + ') ' : '',
                    contrast: scope.contrast ? 'contrast(' + scope.contrast + ') ' : '',
                    grayscale: scope.grayscale ? 'grayscale(' + scope.grayscale + ') ' : ''
                };

            base_image.onload = function () {
                canvas.width = base_image.width;
                canvas.height = base_image.height;

                context.filter = filter.brightness + filter.contrast + filter.grayscale;
                context.drawImage(base_image, 0, 0);
            };

            scope.$watch('brightness', (value, old) => {
                if (value !== old) {
                    filter.brightness = "brightness(" + value + ") ";
                    context.filter = filter.brightness + filter.contrast + filter.grayscale;
                    context.drawImage(base_image, 0, 0);
                }
            });

            scope.$watch('contrast', (value, old) => {
                if (value !== old) {
                    filter.contrast = "contrast(" + value + ") ";
                    context.filter = filter.brightness + filter.contrast + filter.grayscale;
                    context.drawImage(base_image, 0, 0);
                }
            });

            scope.$watch('grayscale', (value, old) => {
                if (value !== old) {
                    filter.grayscale = "grayscale(" + value + ") ";
                    context.filter = filter.brightness + filter.contrast + filter.grayscale;
                    context.drawImage(base_image, 0, 0);
                }
            });

            scope.$watch('rotate', (value, old) => {
                canvas.setAttribute('style', 'transform:rotate(' + value + 'deg); -webkit-transform:rotate(' + value + 'deg); -moz-transform:rotate(' + value + 'deg)');
            });

            base_image.src = scope.src;
        }
    };
});