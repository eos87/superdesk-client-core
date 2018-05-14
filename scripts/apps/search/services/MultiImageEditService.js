MultiImageEditService.$inject = ['$modal', 'authoring'];
export function MultiImageEditService($modal, authoring) {
    this.edit = (data) => {
        $modal.open({
            templateUrl: 'scripts/apps/search/views/multi-image-edit.html',
            controller: ['$scope', 'config', function ($scope, config) {
                $scope.images = data;
                $scope.validator = config.validatorMediaMetadata;

                $scope.metadata = {
                    headline: 'Test',
                    description_text: 'Test',
//                    archive_description: 'Test',
//                    alt_text: 'Test',
//                    byline: 'Test',
//                    copyrightholder: 'Test',
//                    usageterms: 'Test',
//                    copyrightnotice: 'Test'
                };

                $scope.save = () => {
                    angular.forEach($scope.images, (image) => {
                        authoring.save(image, $scope.metadata);
                    });
                };
            }],
            size: 'fullscreen modal--dark-ui'
        });
    };

}